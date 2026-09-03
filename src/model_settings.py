import json

from datetime import datetime

from api.database import main as sqlite
from api.database import queries as sqlite_queries
from src.pi_settings import load_pi_settings


MODEL_TAGS = [ "recommended", "cheap", "fast", "quality", "experimental" ]


def _model_dict( row, default_model : str | None = None ) -> dict:
    tags = []
    try:
        parsed = json.loads( row[ 4 ] or "[]" )
        if isinstance( parsed, list ):
            tags = [ tag for tag in parsed if tag in MODEL_TAGS ]

    except json.JSONDecodeError:
        tags = []

    return {
        "id"         : row[ 0 ],
        "model_id"   : row[ 1 ],
        "label"      : row[ 2 ] or row[ 1 ],
        "is_enabled" : bool( row[ 3 ] ),
        "tags"       : tags,
        "is_default" : row[ 1 ] == default_model,
        "created_at" : row[ 5 ],
        "updated_at" : row[ 6 ],
    }


def _tags_json( tags ) -> str:
    if not isinstance( tags, list ):
        return "[]"

    clean = []
    for tag in tags:
        if tag in MODEL_TAGS and tag not in clean:
            clean.append( tag )

    return json.dumps( clean )


def default_model() -> str:
    return load_pi_settings().get( "pi.model" )


def seed_allowed_models() -> None:
    model_id = default_model()
    if not model_id:
        return

    rows = sqlite.query_database(
        sqlite_queries.AllowedModels.get_model_by_model_id,
        ( model_id, ),
    )

    if rows:
        return

    sqlite.insert_data(
        sqlite_queries.AllowedModels.insert_model,
        sqlite_queries.create_allowed_model_insert_tuple(
            model_id = model_id,
            label    = model_id,
            tags     = json.dumps([ "recommended" ]),
        ),
    )


def list_models( enabled_only : bool = False ) -> list[dict]:
    seed_allowed_models()
    query = sqlite_queries.AllowedModels.get_enabled_models if enabled_only else sqlite_queries.AllowedModels.get_all_models
    rows  = sqlite.query_database( query )
    model = default_model()
    return [ _model_dict( row, model ) for row in rows ]


def get_allowed_model( model_id : str ) -> dict | None:
    if not model_id:
        return None

    seed_allowed_models()
    rows = sqlite.query_database(
        sqlite_queries.AllowedModels.get_model_by_model_id,
        ( model_id, ),
    )

    return _model_dict( rows[ 0 ], default_model() ) if rows else None


def enabled_model( model_id : str ) -> dict | None:
    model = get_allowed_model( model_id )
    if not model or not model[ "is_enabled" ]:
        return None

    return model


def resolve_queue_model( model_id : str | None = None ) -> str:
    selected = model_id or default_model()
    if not enabled_model( selected ):
        raise ValueError( "Selected model is not enabled." )

    return selected


def add_allowed_model( model_id : str, label : str | None = None, tags = None ) -> bool:
    if not model_id:
        return False

    return sqlite.insert_data(
        sqlite_queries.AllowedModels.insert_model,
        sqlite_queries.create_allowed_model_insert_tuple(
            model_id = model_id,
            label    = label or model_id,
            tags     = _tags_json( tags or [] ),
        ),
    )


def update_allowed_model( model_id : str, label : str | None, is_enabled : bool, tags ) -> None:
    current = get_allowed_model( model_id )
    if not current:
        raise ValueError( "Model not found." )

    if current[ "is_default" ] and not is_enabled:
        raise ValueError( "Default model cannot be disabled." )

    if current[ "is_enabled" ] and not is_enabled:
        rows = sqlite.query_database( sqlite_queries.AllowedModels.count_enabled_models )
        if rows and rows[ 0 ][ 0 ] <= 1:
            raise ValueError( "At least one model must stay enabled." )

    sqlite.update_data(
        sqlite_queries.AllowedModels.update_model,
        (
            label or model_id,
            int( is_enabled ),
            _tags_json( tags or [] ),
            datetime.now().isoformat(),
            current[ "id" ],
        ),
    )
