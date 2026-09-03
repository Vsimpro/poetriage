import json, os

from datetime import datetime
from pathlib import Path

from api.database import main as sqlite
from api.database import queries as sqlite_queries


SETTING_DEFAULTS = {
    "pi.provider"            : ("PI_PROVIDER", "openrouter", 0),
    "pi.model"               : ("PI_MODEL", "z-ai/glm-5.3-flash", 0),
    "pi.openrouter.api_key"  : ("PI_OPENROUTER_API_KEY", "", 1),
    "pi.openrouter.base_url" : ("PI_OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1", 0),
    "pi.remnux.container"    : ("PI_REMNUX_CONTAINER", "remnux-pi", 0),
    "pi.remnux.timeout"      : ("PI_REMNUX_TIMEOUT", "600", 0),
}


#
#   Metadata helpers
#
def _now() -> str:          return datetime.now().isoformat()

def pi_agent_dir() -> Path: return Path( os.getenv( "PI_CODING_AGENT_DIR", "data/pi-agent" ) )

def _setting_value( key : str ) -> str:
    env_name, fallback, _is_secret = SETTING_DEFAULTS[ key ]
    return os.getenv( env_name, fallback )


#
#   JSON helpers
#
def _read_json( path : Path, default : dict ) -> dict:
    if not path.exists():
        return dict( default )

    with open( path, "r", encoding = "utf-8" ) as file:
        data = json.load( file )

    if not isinstance( data, dict ):
        raise ValueError( f"Pi config must be a JSON object: {path}" )

    return data


def _write_json( path : Path, data : dict ) -> None:
    path.parent.mkdir( parents = True, exist_ok = True )
    temp = path.with_name( f"{path.name}.tmp-{os.getpid()}" )

    with open( temp, "w", encoding = "utf-8" ) as file:
        json.dump( data, file, indent = 2 )
        file.write( "\n" )

    temp.replace( path )



def _model_entry( model : str ) -> dict:
    if model == "z-ai/glm-5.3-flash":
        return {
            "id"            : model,
            "name"          : model,
            "reasoning"     : True,
            "input"         : [ "text", "image" ],
            "contextWindow" : 1048576,
            "maxTokens"     : 131072,
            "cost"          : {
                "input"      : 0.075,
                "output"     : 0.25,
                "cacheRead"  : 0.015,
                "cacheWrite" : 0,
            },
        }

    return {
        "id"            : model,
        "name"          : model,
        "reasoning"     : False,
        "input"         : [ "text" ],
        "contextWindow" : 131072,
        "maxTokens"     : 8192,
        "cost"          : {
            "input"      : 0,
            "output"     : 0,
            "cacheRead"  : 0,
            "cacheWrite" : 0,
        },
    }


#
#   Interface
#
def initialize_settings_from_env() -> None:
    for key, (_env_name, _fallback, is_secret) in SETTING_DEFAULTS.items():
        value = _setting_value( key )
        sqlite.insert_data(
            sqlite_queries.AppSettings.insert_setting_if_missing,
            ( key, value, is_secret, _now() ),
        )

        rows = sqlite.query_database(
            sqlite_queries.AppSettings.get_setting_by_key,
            ( key, ),
        )

        if is_secret and value and rows and not rows[ 0 ][ 1 ]:
            sqlite.update_data(
                sqlite_queries.AppSettings.update_setting,
                ( value, is_secret, _now(), key ),
            )


def upsert_setting( key : str, value : str, is_secret : int = 0 ) -> None:
    sqlite.insert_data(
        sqlite_queries.AppSettings.upsert_setting,
        ( key, value, is_secret, _now() ),
    )


def load_pi_settings() -> dict:
    settings = {
        key : _setting_value( key )
        for key in SETTING_DEFAULTS
    }

    rows = sqlite.query_database( sqlite_queries.AppSettings.get_all_settings )
    for key, value, _is_secret, _updated_at in rows:
        if key in settings and value is not None:
            settings[ key ] = value

    return settings


def sync_models_json( config_dir : Path, settings : dict ) -> None:
    path = config_dir / "models.json"
    data = _read_json( path, { "providers" : {} } )

    providers  = data.setdefault( "providers", {} )
    openrouter = providers.setdefault( "openrouter", {} )
    model      = settings[ "pi.model" ]

    openrouter[ "baseUrl" ] = settings[ "pi.openrouter.base_url" ]
    openrouter[ "api" ]     = "openai-completions"
    openrouter[ "apiKey" ]  = settings[ "pi.openrouter.api_key" ]
    openrouter[ "compat" ]  = {
        "supportsDeveloperRole"      : False,
        "supportsReasoningEffort"    : True,
        "supportsUsageInStreaming"   : True,
        "supportsStrictMode"         : False,
        "maxTokensField"             : "max_tokens",
    }

    openrouter[ "models" ] = [ _model_entry( model ) ]

    _write_json( path, data )


def sync_settings_json( config_dir : Path, settings : dict ) -> None:
    path = config_dir / "settings.json"
    data = _read_json( path, {} )

    data[ "defaultModel" ]    = settings[ "pi.model" ]
    data[ "defaultProvider" ] = settings[ "pi.provider" ]
    data.setdefault( "lastChangelogVersion", "0.84.3" )
    data.setdefault( "theme", "dark" )
    data.setdefault( "skills", [] )
    data.setdefault( "defaultThinkingLevel", "medium" )
    data.setdefault( "packages", [ "npm:pi-mcp-adapter@2.27.0" ] )

    _write_json( path, data )


def _set_arg_value( args : list, prefix : str, value : str ) -> list:
    updated = False
    result  = []

    for arg in args:
        if isinstance( arg, str ) and arg.startswith( prefix ):
            result.append( f"{prefix}{value}" )
            updated = True
            continue

        result.append( arg )

    if not updated:
        result.append( f"{prefix}{value}" )

    return result


def sync_mcp_json( config_dir : Path, settings : dict ) -> None:
    path = config_dir / "mcp.json"
    data = _read_json( path, { "mcpServers" : {} } )

    servers = data.setdefault( "mcpServers", {} )
    remnux  = servers.setdefault( "remnux", {} )
    args    = remnux.setdefault( "args", [ "-y", "@remnux/mcp-server@0.1.70", "--mode=docker" ] )

    remnux.setdefault( "command", "npx" )
    remnux.setdefault( "lifecycle", "lazy" )
    remnux.setdefault( "requestTimeoutMs", 900000 )
    remnux.setdefault( "directTools", False )
    remnux.setdefault( "approveTools", False )

    args = _set_arg_value( args, "--container=", settings[ "pi.remnux.container" ] )
    args = _set_arg_value( args, "--timeout=", settings[ "pi.remnux.timeout" ] )
    remnux[ "args" ] = args

    _write_json( path, data )


def sync_auth_json( config_dir : Path ) -> None:
    path = config_dir / "auth.json"
    if not path.exists():
        _write_json( path, {} )


def sync_pi_config( settings : dict | None = None ) -> dict:
    settings   = settings or load_pi_settings()
    config_dir = pi_agent_dir()
    config_dir.mkdir( parents = True, exist_ok = True )

    sync_models_json( config_dir, settings )
    sync_settings_json( config_dir, settings )
    sync_mcp_json( config_dir, settings )
    sync_auth_json( config_dir )

    return settings
