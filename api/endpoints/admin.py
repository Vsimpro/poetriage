"""
*   This file has been slopped. Beware!
*   -Vs1m, 07/2026
"""
import json, sqlite3, urllib.error, urllib.request

from datetime    import datetime
from flask      import Blueprint, g, jsonify, request

from api.database import main    as sqlite
from api.database import queries as sqlite_queries

from api.endpoints import (
    admin_required,
    generate_password_hash,
    login_required,
    row_to_user_dict,
)

from src.pi_settings import load_pi_settings, sync_pi_config, upsert_setting
from src.model_settings import (
    MODEL_TAGS,
    add_allowed_model,
    default_model,
    list_models,
    update_allowed_model,
)


ENDPOINT = "/api/admin"
ADMIN_BP = Blueprint( "admin", __name__, url_prefix = ENDPOINT )


def _now() -> str:
    return datetime.now().isoformat()


def _models_url( base_url : str ) -> str:
    return base_url.rstrip( "/" ) + "/models"


def _discover_openrouter_models() -> list[dict]:
    settings = load_pi_settings()
    api_key  = settings.get( "pi.openrouter.api_key" )

    if not api_key:
        raise ValueError( "OpenRouter API key is not configured." )

    request = urllib.request.Request(
        _models_url( settings.get( "pi.openrouter.base_url" ) or "https://openrouter.ai/api/v1" ),
        headers = { "Authorization" : f"Bearer {api_key}" },
    )

    with urllib.request.urlopen( request, timeout = 30 ) as response:
        payload = json.loads( response.read().decode( "utf-8" ) )

    models = payload.get( "data", [] ) if isinstance( payload, dict ) else []
    result = []

    for item in models:
        model_id = item.get( "id" ) if isinstance( item, dict ) else None
        if not model_id:
            continue

        result.append({
            "model_id" : model_id,
            "label"    : item.get( "name" ) or model_id,
        })

    return result


def _discovered_model_ids() -> set:
    return { item[ "model_id" ] for item in _discover_openrouter_models() }


@ADMIN_BP.route( "/users",  methods = [ "GET" ] )
@ADMIN_BP.route( "/users/", methods = [ "GET" ] )
@login_required
@admin_required
def list_users():
    """
    Endpoint:
        GET /api/admin/users

    Returns:
        200 list of user dicts (password_hash omitted)
    """
    try:
        rows = sqlite.query_database( sqlite_queries.Users.get_all_users )
    except sqlite3.Error as e:
        print( f"[ADMIN][!] List users failed. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    users = [ row_to_user_dict( r ) for r in rows ]
    return jsonify( users ), 200


@ADMIN_BP.route( "/users",  methods = [ "POST" ] )
@ADMIN_BP.route( "/users/", methods = [ "POST" ] )
@login_required
@admin_required
def create_user():
    """
    Endpoint:
        POST /api/admin/users

    Body (JSON):
        {"username": str, "password": str}

    Returns:
        201 user dict
        406 missing fields
        400 password too short
        409 username already exists
    """
    data     : dict = request.get_json( silent = True ) or { }
    username  : str = data.get( "username" )
    password  : str = data.get( "password" )

    if not username or not password:
        return jsonify( { "status" : "required fields not met" } ), 406

    if len( password ) < 8:
        return jsonify( { "status" : "error", "error" : "Password must be at least 8 characters" } ), 400

    # Pre-check username uniqueness (the existing insert_data helper
    # swallows IntegrityError into a generic False, so we cannot rely
    # on it returning a useful signal).
    existing = sqlite.query_database(
        sqlite_queries.Users.get_user_by_username,
        ( username, ),
    )

    if existing:
        return jsonify( { "status" : "error", "error" : "Username already exists" } ), 409

    password_hash = generate_password_hash( password )
    insert_tuple  = sqlite_queries.create_user_insert_tuple(
        username      = username,
        password_hash = password_hash,
        is_admin      = 0,
        is_active     = 1,
    )

    try:
        ok = sqlite.insert_data( sqlite_queries.Users.insert_user, insert_tuple )
    except sqlite3.Error as e:
        # The existing helper swallows IntegrityError into a generic False,
        # so this branch is rarely hit. Pre-check above handles username dupes.
        print( f"[ADMIN][!] Insert user failed. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    if not ok:
        return jsonify( { "status" : "error" } ), 500

    # Look up the row we just created so we can return the canonical record.
    rows = sqlite.query_database(
        sqlite_queries.Users.get_user_by_username,
        ( username, ),
    )

    if not rows:
        return jsonify( { "status" : "error" } ), 500

    return jsonify( row_to_user_dict( rows[ 0 ] ) ), 201


@ADMIN_BP.route( "/users/<user_id>",  methods = [ "PATCH" ] )
@ADMIN_BP.route( "/users/<user_id>/", methods = [ "PATCH" ] )
@login_required
@admin_required
def update_user( user_id : str ):
    """
    Endpoint:
        PATCH /api/admin/users/<user_id>

    Body (JSON):
        {"is_active": bool}

    Returns:
        200 updated user dict
        400 missing field / self-deactivation
        403 target is admin
        404 user not found
    """
    data     : dict = request.get_json( silent = True ) or { }

    if "is_active" not in data:
        return jsonify( { "status" : "required fields not met" } ), 406

    if user_id == g.current_user[ "id" ]:
        return jsonify( { "status" : "error", "error" : "Cannot deactivate self" } ), 400

    is_active : bool = bool( data[ "is_active" ] )

    rows = sqlite.query_database(
        sqlite_queries.Users.get_user_by_id,
        ( user_id, ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "User not found" } ), 404

    if rows[ 0 ][ 3 ]:
        return jsonify( { "status" : "error", "error" : "Cannot modify admin accounts" } ), 403

    try:
        ok = sqlite.update_data(
            sqlite_queries.Users.update_user_active,
            ( int( is_active ), user_id ),
        )
    except sqlite3.Error as e:
        print( f"[ADMIN][!] Update user failed. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    if not ok:
        return jsonify( { "status" : "error" } ), 500

    # Re-read to return the canonical record.
    rows = sqlite.query_database(
        sqlite_queries.Users.get_user_by_id,
        ( user_id, ),
    )

    return jsonify( row_to_user_dict( rows[ 0 ] ) ), 200


@ADMIN_BP.route( "/models",  methods = [ "GET" ] )
@ADMIN_BP.route( "/models/", methods = [ "GET" ] )
@login_required
@admin_required
def get_allowed_models():
    return jsonify({
        "default_model" : default_model(),
        "tags"          : MODEL_TAGS,
        "models"        : list_models(),
    }), 200


@ADMIN_BP.route( "/models/discover",  methods = [ "POST" ] )
@ADMIN_BP.route( "/models/discover/", methods = [ "POST" ] )
@login_required
@admin_required
def discover_models():
    try:
        return jsonify( _discover_openrouter_models() ), 200

    except ValueError as e:
        return jsonify( { "status" : "error", "error" : str( e ) } ), 400

    except ( urllib.error.URLError, json.JSONDecodeError ) as e:
        print( f"[ADMIN][!] Model discovery failed. Error: ", e )
        return jsonify( { "status" : "error", "error" : "Could not discover models." } ), 502


@ADMIN_BP.route( "/models",  methods = [ "POST" ] )
@ADMIN_BP.route( "/models/", methods = [ "POST" ] )
@login_required
@admin_required
def add_model():
    data     : dict = request.get_json( silent = True ) or {}
    model_id : str  = ( data.get( "model_id" ) or "" ).strip()

    if not model_id:
        return jsonify( { "status" : "required fields not met" } ), 406

    try:
        if model_id not in _discovered_model_ids():
            return jsonify( { "status" : "error", "error" : "Model was not found from provider discovery." } ), 400

    except ValueError as e:
        return jsonify( { "status" : "error", "error" : str( e ) } ), 400

    except ( urllib.error.URLError, json.JSONDecodeError ) as e:
        print( f"[ADMIN][!] Model validation discovery failed. Error: ", e )
        return jsonify( { "status" : "error", "error" : "Could not validate model." } ), 502

    if not add_allowed_model( model_id, data.get( "label" ), data.get( "tags" ) or [] ):
        return jsonify( { "status" : "error" } ), 500

    return jsonify({
        "default_model" : default_model(),
        "tags"          : MODEL_TAGS,
        "models"        : list_models(),
    }), 201


@ADMIN_BP.route( "/models/<path:model_id>",  methods = [ "PATCH" ] )
@ADMIN_BP.route( "/models/<path:model_id>/", methods = [ "PATCH" ] )
@login_required
@admin_required
def update_model( model_id : str ):
    data : dict = request.get_json( silent = True ) or {}
    is_default = bool( data.get( "is_default", False ) )
    is_enabled = True if is_default else bool( data.get( "is_enabled", True ) )

    try:
        update_allowed_model(
            model_id    = model_id,
            label       = data.get( "label" ),
            is_enabled  = is_enabled,
            tags        = data.get( "tags" ) or [],
        )

        if is_default:
            upsert_setting( "pi.model", model_id )
            sync_pi_config( load_pi_settings() )

    except ValueError as e:
        return jsonify( { "status" : "error", "error" : str( e ) } ), 400

    return jsonify({
        "default_model" : default_model(),
        "tags"          : MODEL_TAGS,
        "models"        : list_models(),
    }), 200
