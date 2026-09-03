import os, json, subprocess
from pathlib import Path


ROOT        = Path(__file__).resolve().parents[1]
PI_CONFIG   = Path( os.getenv( "PI_CODING_AGENT_DIR", ROOT / "data" / "pi-agent" ) )
PI_SESSIONS = Path( os.getenv( "PI_CODING_AGENT_SESSION_DIR", ROOT / "data" / "pi-sessions" ) )
REPORT_TOOL = Path( os.getenv( "PI_REPORT_TOOL", ROOT / "pi-report-tool" / "index.ts" ) )
MCP_CONFIG  = PI_CONFIG / "mcp.json"


# Session input tracking.
PI_SECTION     = None
THINKING       = {"thinking", "thinking_delta", "reasoning", "reasoning_delta"}
TOOLING        = {"toolcall_delta", "toolcall_update"}
CONVERSATION   = ""
FINAL_USAGE    = None
USAGE_TOTAL    = None
REPORT_DETAILS = None


def get_usage( total : dict | None, usage : dict ):
    if total is None: total = {}

    for key, value in usage.items():
        if key == "cost" and isinstance( value, dict ):
            total.setdefault( "cost", {} )
            
            for cost_key, cost_value in value.items():
                if isinstance( cost_value, ( int, float ) ):
                    total["cost"][cost_key] = total["cost"].get( cost_key, 0 ) + cost_value

            continue
        
        if isinstance( value, ( int, float ) ):
            total[key] = total.get( key, 0 ) + value

    return total


def track_pi_event( data : dict ):
    global FINAL_USAGE
    global USAGE_TOTAL
    global REPORT_DETAILS

    if data.get( "type" ) == "message_end":
        message = data.get( "message", {} )
        usage   = message.get( "usage" )

        if message.get( "role" ) == "assistant" and isinstance( usage, dict ):
            FINAL_USAGE = usage
            USAGE_TOTAL = get_usage( USAGE_TOTAL, usage )

    if data.get( "type" ) == "tool_execution_end":
        result = data.get( "result", {} )

        if (
            data.get( "toolName" ) == "submit_structured_report"
            and data.get( "isError" ) is False
            and isinstance( result.get( "details" ), dict )
        ):
            REPORT_DETAILS = result["details"]


def parse_pi_out( line : str ):
    try:
    
        data = json.loads( line )
        track_pi_event( data )
        event = data.get(
            "assistantMessageEvent", 
            {}
        )
        
    except json.JSONDecodeError:
        return
    
    global PI_SECTION
    global CONVERSATION
        
    _type   = event.get("type", "")
    _delta  = event.get("delta")
    _section = (
        "thinking"      if _type in THINKING
        else "toolcall" if _type in TOOLING
        else "answer"
    )

    # Tool calls
    if _type == "toolcall_start":
        PI_SECTION = "toolcall"
        print(f"\n[+][toolcall:\t{event.get('toolName', 'unknown')}]\n", end="", flush=True)
        return

    if _type == "toolcall_end":
        PI_SECTION = None
        return

    # No message.
    if not _delta:
        return

    # Messages observed.
    if _section != PI_SECTION:
        PI_SECTION = _section
        if _section == "thinking":
            print("\n[%][thinking]\n", end="", flush=True)
        
        if _section == "toolcall":
            print("\n<[+][toolcall]\n ", end="", flush=True)
        
        if _section == "answer":
            print("\n", end="", flush=True)

    CONVERSATION += _delta
    print(_delta, end="", flush=True)
    # Todo, make this print optional.


def pi_env():
    return {
        **os.environ,
        "PI_CODING_AGENT_DIR"        : str( PI_CONFIG   ),
        "PI_CODING_AGENT_SESSION_DIR": str( PI_SESSIONS ),
    }


def run_pi( system_prompt : str, prompt : str, model : str, provider : str ):
    """
    Pi agent wrapper.
    
    Args:
        system_prompt (str) : The system prompt for this run.
        prompt        (str) : The user prompt for this run.
        model         (str) : What model we wish to use.
        provider      (str) : What provider we wish to use.
        
    Returns:
        tuple( stdout : str, stderr : str )
    """
    
    global CONVERSATION
    global FINAL_USAGE
    global USAGE_TOTAL
    global REPORT_DETAILS

    CONVERSATION   = ""
    FINAL_USAGE    = None
    USAGE_TOTAL    = None
    REPORT_DETAILS = None

    command = [ 
        "pi", "-p", 
        "--mode",     "json",
        "--model",    model,    #"ornith-1.5-pi",
        "--provider", provider, #"llama.cpp",
        "--extension", str( REPORT_TOOL ),
        "--mcp-config", str( MCP_CONFIG ),
        "--system-prompt", system_prompt,
        "--approve",
        
        "--no-builtin-tools",
        "--no-context-files",
        "--no-skills",
        "--no-prompt-templates",
        "--no-themes",
        "--no-session",
        
        prompt
    ]
    
    stdout_lines = []

    process = subprocess.Popen(
        command,
        stdout  = subprocess.PIPE,
        stderr  = subprocess.PIPE,
        text    = True,
        bufsize = 1,
        env     = pi_env()
    )

    # Parase stdout
    for line in process.stdout:
        stdout_lines.append( line )
        parse_pi_out( line )

    stderr      = process.stderr.read()   
    return_code = process.wait()
    
    return {
        "conversation"   : CONVERSATION,
        "raw_stdout"     : "".join( stdout_lines ),
        "return_code"    : return_code,
        "stderr"         : stderr,
        "provider"       : provider,
        "model"          : model,
        "command"        : command,
        "report_tool"    : str( REPORT_TOOL ),
        "report_tool_exists" : REPORT_TOOL.exists(),
        "mcp_config"     : str( MCP_CONFIG ),
        "mcp_config_exists" : MCP_CONFIG.exists(),
        "usage"          : {
            "total"         : USAGE_TOTAL,
            "final_message" : FINAL_USAGE,
        },
        "report_details" : REPORT_DETAILS,
    }
