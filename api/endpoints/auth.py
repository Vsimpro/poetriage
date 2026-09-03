"""
*   This file has been slopped. Beware!
*   -Vs1m, 07/2026
"""
import secrets, sqlite3

from datetime import datetime, timedelta

from flask      import Blueprint, g, jsonify, request, session

from api.database import main    as sqlite
from api.database import queries as sqlite_queries

from api.endpoints import (
    REMEMBER_COOKIE_NAME,
    REMEMBER_MAX_AGE_SECONDS,
    check_password_hash,
    login_required,
    remember_token_hash,
    row_to_user_dict,
)


ENDPOINT = "/api/auth"
AUTH_BP  = Blueprint( "auth", __name__, url_prefix = ENDPOINT )


@AUTH_BP.route( "/login",  methods = [ "POST" ] )
@AUTH_BP.route( "/login/", methods = [ "POST" ] )
def login():
    """
    Endpoint:
        POST /api/auth/login

    Body (JSON):
        {"username": str, "password": str}

    Returns:
        201 user dict on success
        400 missing fields
        401 invalid credentials
        403 deactivated account
    """
    data    : dict = request.get_json( silent = True ) or { }
    username : str = data.get( "username" )
    password : str = data.get( "password" )

    if not username or not password:
        return jsonify( { "status" : "required fields not met" } ), 406

    try:
        rows = sqlite.query_database(
            sqlite_queries.Users.get_user_by_username,
            ( username, ),
        )
    except sqlite3.Error as e:
        print( f"[AUTH][!] Login lookup failed. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    if not rows:
        return jsonify( { "status" : "error", "error" : "Invalid credentials" } ), 401

    user = rows[ 0 ]

    if not check_password_hash( user[ 2 ], password ):
        return jsonify( { "status" : "error", "error" : "Invalid credentials" } ), 401

    if not user[ 4 ]:
        return jsonify( { "status" : "error", "error" : "Account deactivated" } ), 403

    remember_token = secrets.token_urlsafe( 48 )
    remember_expires_at = datetime.now() + timedelta( seconds = REMEMBER_MAX_AGE_SECONDS )

    ok = sqlite.update_data(
        sqlite_queries.Users.update_remember_token_by_id,
        ( remember_token_hash( remember_token ), remember_expires_at.isoformat(), user[ 0 ] ),
    )

    if not ok:
        return jsonify( { "status" : "error" } ), 500

    session.permanent = True
    session[ "user_id" ] = user[ 0 ]
    response = jsonify( row_to_user_dict( user ) )
    response.set_cookie(
        REMEMBER_COOKIE_NAME,
        remember_token,
        max_age = REMEMBER_MAX_AGE_SECONDS,
        httponly = True,
        samesite = "Lax",
        secure = False,
        path = "/",
    )
    return response, 201


@AUTH_BP.route( "/logout",  methods = [ "POST" ] )
@AUTH_BP.route( "/logout/", methods = [ "POST" ] )
def logout():
    """
    Endpoint:
        POST /api/auth/logout

    Returns:
        200 {"message": "Logged out"}
    """
    user_id = session.get( "user_id" )
    remember_token = request.cookies.get( REMEMBER_COOKIE_NAME )

    if user_id:
        sqlite.update_data(
            sqlite_queries.Users.clear_remember_token_by_id,
            ( user_id, ),
        )
    elif remember_token:
        sqlite.update_data(
            sqlite_queries.Users.clear_remember_token_by_hash,
            ( remember_token_hash( remember_token ), ),
        )

    session.clear()
    response = jsonify( { "message" : "Logged out" } )
    response.delete_cookie( REMEMBER_COOKIE_NAME, path = "/" )
    return response, 200


@AUTH_BP.route( "/me",  methods = [ "GET" ] )
@AUTH_BP.route( "/me/", methods = [ "GET" ] )
@login_required
def me():
    """
    Endpoint:
        GET /api/auth/me

    Returns:
        200 current user dict
    """
    return jsonify( g.current_user ), 200
