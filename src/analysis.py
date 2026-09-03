import hashlib, json

from pathlib import Path

import src.container as container

from prompts.manager import PromptManager as Prompts
from src.pi          import run_pi
from src.pi_settings import load_pi_settings, sync_pi_config


PROMPT_MANAGER = Prompts()


def readable_usage( usage : dict | None ):
    """
    Convert the raw Pi usage data into report-friendly metadata.

    Args:
        usage (dict | None) : Raw usage object from the Pi run.

    Returns:
        dict | None : Readable usage data, or None when usage is missing.
    """
    # TODO: Make the variable names make sense here.
    if not usage:
        return None

    readable = dict( usage )
    cost     = readable.get( "cost", {} )

    if isinstance( cost, dict ):
        readable["cost"] = f"${cost.get( 'total', 0 ):.5f}"

    return readable


def enrich_report( path : str, run : dict ):
    """
    Add model, provider, and usage metadata to the report file.

    Args:
        path (str) : Report path written by submit_structured_report.
        run  (dict): Pi run result containing model, provider, and usage data.

    Returns:
        None
    """
    
    # This shouldnt happen, look to remove.
    if not path:
        return

    # Final report file doesnt exist for some reason.
    report_path = Path( path )
    if not report_path.exists():
        return

    data  = json.loads( report_path.read_text( encoding = "utf-8" ) )
    usage = run.get( "usage" ) or {}

    data["provider"] = run.get( "provider" )
    data["model"]    = run.get( "model" )
    data["usage"]    = {
        "total"         : readable_usage( usage.get( "total" ) ),
        "final_message" : readable_usage( usage.get( "final_message" ) ),
    }

    # Write the enrichment data into place.
    report_path.write_text(
        json.dumps( data, indent = 2 ) + "\n",
        encoding = "utf-8"
    )


def normalize_analysis( analysis : str ):
    """
    Normalize the report before storing it in database table.

    Args:
        analysis (str) : Raw artifact content from the structured report.

    Returns:
        tuple : Markdown report, embedded structured data, and context-rot flag.
    """

    try:
        parsed = json.loads( analysis )

    except json.JSONDecodeError:
        return analysis, None, 0

    if isinstance( parsed, dict ) and isinstance( parsed.get( "report" ), str ):
        return parsed.get( "report" ), parsed, 1

    return analysis, None, 0


def normalize_structured_data( value ):
    """
    Normalize structured_data emitted by submit_structured_report.

    Some models submit this field as a JSON object, while others submit a
    JSON-encoded string. Keep object behavior unchanged and only decode strings.
    """
    if isinstance( value, dict ):
        return value

    if isinstance( value, str ):
        try:
            parsed = json.loads( value )

        except json.JSONDecodeError:
            return {}

        if isinstance( parsed, dict ):
            return parsed

    return {}



def run_analysis_for_sample( sample_path : str | Path, model : str | None = None ) -> dict:
    """
    Run the Pi malware analysis workflow for a local sample.

    Args:
        sample_path (str | Path) : Local path to the uploaded sample.
        model      (str | None) : Optional frozen model id for this run.

    Returns:
        dict : Normalized analysis result ready for database storage.
    """
    
    settings = load_pi_settings()
    if model:
        settings[ "pi.model" ] = model

    settings = sync_pi_config( settings )

    if settings.get( "pi.provider" ) == "openrouter" and not settings.get( "pi.openrouter.api_key" ):
        raise RuntimeError( "OpenRouter API key is not configured." )

    container.reset_container()
        
    sample         = Path( sample_path )
    raw            = sample.read_bytes()
    container_path = container.copy_to_container( sample )

    #
    # Build the prompts
    #
    
    # System default TODO: Load this from DB to modify it from UI.
    default_system_prompt = PROMPT_MANAGER.render(
        "./default.md",
        final_report_nonce = "- Canary_token.",
        sample_path        = container_path
    )
    
    # Demo of guiding the agent to use tools well. TODO: Incorporate this into pi config instead.
    agents_prompt = PROMPT_MANAGER.load("AGENTS.md").strip()
    if agents_prompt:
        default_system_prompt += "\n\n" + agents_prompt

    # This is done so we get the finalized report as per schema
    default_system_prompt += "\n\nWhen complete, call submit_structured_report as your final action. Do not provide the final report as prose."

    #
    # Pi goes brr.
    #
    
    run = run_pi(
        system_prompt = default_system_prompt,
        prompt        = "Analyze the supplied sample and call submit_structured_report as your final action.",
        model         = settings.get( "pi.model" ),
        provider      = settings.get( "pi.provider" )
    )

    # Enrich the final report
    report_details = run.get( "report_details" ) or {}
    enrich_report( report_details.get( "latestPath" ),  run )
    enrich_report( report_details.get( "historyPath" ), run )

    # Issue with the report generation -- fail the run.
    latest_path = report_details.get( "latestPath" )
    if not latest_path:
        raise RuntimeError( "Pi did not submit a structured report at the end of the run." )

    # Prepare other metadata for the db insert.
    data        = json.loads( Path( latest_path ).read_text( encoding = "utf-8" ) )
    report      = data.get( "report", {} )
    report[ "provider" ] = data.get( "provider" )
    report[ "model" ]    = data.get( "model" )
    artifact    = report.get( "artifact", {} )
    structured  = normalize_structured_data(
        report.get( "structured_data" ) or artifact.get( "structured_data" )
    )
    usage       = run.get( "usage" ) or {}
    total       = usage.get( "total" ) or {}
    final       = usage.get( "final_message" ) or {}
    cost        = total.get( "cost" ) or {}
    
    analysis, embedded, normalized = normalize_analysis(
        artifact.get( "content", "" )
    )

    return {
        "filename"                         : sample.name,
        "md5"                              : hashlib.md5( raw ).hexdigest(),
        "sha256"                           : hashlib.sha256( raw ).hexdigest(),
        "size"                             : len( raw ),
        "analysis"                         : analysis,
        "token_count"                      : total.get( "totalTokens", 0 ),
        "analysis_token_count"             : total.get( "totalTokens", 0 ),
        "summary_token_count"              : 0,
        "final_conversation_token_count"   : final.get( "totalTokens" ),
        "analysis_cost"                    : cost.get( "total", 0 ) if isinstance( cost, dict ) else 0,
        "analysis_cost_complete"           : 1,
        "analysis_json"                    : json.dumps( report ),
        "analysis_context_rot"             : normalized or ( 0 if analysis else 1 ),
        "risk_score"                       : structured.get( "risk_score" ) or ( embedded or {} ).get( "risk_score" ),
        "analysis_tool_log"                : run.get( "stderr" ),
    }



def update_file_with_result( file_id : str, result : dict, status : str = "done" ):
    """
    Builds the update details in order to store them as completed analysis results.

    Args:
        file_id (str)  : Files.id value to update.
        result  (dict) : Normalized result from run_analysis_for_sample.
        status  (str)  : Final file status to store.

    Returns:
        tuple : Parameters for Files.update_file_analysis_result_by_id.
    """
    return (
        result.get( "analysis" ),
        status,
        result.get( "token_count", 0 ),
        result.get( "analysis_token_count", 0 ),
        result.get( "summary_token_count", 0 ),
        result.get( "final_conversation_token_count" ),
        result.get( "analysis_cost", 0 ),
        result.get( "analysis_cost_complete", 1 ),
        result.get( "analysis_json" ),
        result.get( "analysis_context_rot", 0 ),
        result.get( "risk_score" ),
        result.get( "analysis_tool_log" ),
        file_id,
    )
