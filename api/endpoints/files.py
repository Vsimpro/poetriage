"""
*   This file has been slopped. Beware!
*   -Vs1m, 07/2026
"""
import hashlib, os, sqlite3, uuid

from flask      import Blueprint, Response, current_app, g, jsonify, request
from werkzeug.utils import secure_filename

from api.database import main    as sqlite
from api.database import queries as sqlite_queries

from api.endpoints import (
    login_required,
    row_to_file_dict,
)
from src.model_settings import resolve_queue_model


ENDPOINT = "/api"
FILES_BP = Blueprint( "files", __name__, url_prefix = ENDPOINT )


def _upload_dir() -> str:
    return current_app.config[ "UPLOAD_DIR" ]


def _extension_for( filename : str ) -> str:
    """
    Pull the trailing extension off a sanitized filename, default to 'bin'.
    """
    safe = secure_filename( filename or "" )
    _, ext = os.path.splitext( safe )
    ext = ext.lstrip( "." )
    return ext or "bin"


def _disk_path( file_id : str, ext : str ) -> str:
    return os.path.join( _upload_dir(), f"{file_id}.{ext}" )


def _report_download_filename( filename : str ) -> str:
    safe = secure_filename( filename or "report" ) or "report"
    return f"{safe}-intelligence-report.md"


def _markdown_report_response( file_row ):
    analysis = file_row[ 6 ] or ""

    if not analysis.strip():
        return jsonify( { "status" : "error", "error" : "Report is not ready" } ), 409

    download_name = _report_download_filename( file_row[ 1 ] )

    return Response(
        analysis,
        content_type = "text/markdown; charset=utf-8",
        headers = {
            "Content-Disposition" : f"attachment; filename=\"{download_name}\"",
        },
    )


#
#   /api/upload
#
@FILES_BP.route( "/upload",  methods = [ "POST" ] )
@FILES_BP.route( "/upload/", methods = [ "POST" ] )
@login_required
def upload():
    """
    Endpoint:
        POST /api/upload

    multipart/form-data with a 'file' field.

    Returns:
        201 file dict (new or existing duplicate)
        400 missing file part
    """
    if "file" not in request.files:
        return jsonify( { "status" : "error", "error" : "No file part" } ), 400

    upload    = request.files[ "file" ]
    model_id  = request.form.get( "model_id" )
    raw       = upload.read()
    md5sum    = hashlib.md5( raw ).hexdigest()
    sha256sum = hashlib.sha256( raw ).hexdigest()

    user_id = g.current_user[ "id" ]

    try:
        model_id = resolve_queue_model( model_id )

    except ValueError as e:
        return jsonify( { "status" : "error", "error" : str( e ) } ), 400

    # Duplicate check (per owner).
    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( user_id, sha256sum ),
    )

    if rows:
        return jsonify( row_to_file_dict( rows[ 0 ] ) ), 201

    file_id   = str( uuid.uuid4() )
    ext       = _extension_for( upload.filename )
    disk_path = _disk_path( file_id, ext )

    with open( disk_path, "wb" ) as f:
        f.write( raw )

    os.chmod( disk_path, 0o666 )

    insert_tuple = sqlite_queries.create_file_insert_tuple(
        filename     = upload.filename or f"{file_id}.{ext}",
        md5          = md5sum,
        sha256       = sha256sum,
        size         = len( raw ),
        owner_user_id = user_id,
        file_id      = file_id,
        status       = "pending",
    )

    # The existing database helper swallows IntegrityError into a generic False
    # return, so we cannot distinguish a UNIQUE conflict from any other error
    # via exceptions. Pre-check the duplicate, then re-query on a False return
    # to detect a TOCTOU race.
    ok = sqlite.insert_data( sqlite_queries.Files.insert_into_files, insert_tuple )

    if not ok:
        rows = sqlite.query_database(
            sqlite_queries.Files.get_owned_file_by_sha256,
            ( user_id, sha256sum ),
        )

        try:
            os.remove( disk_path )
        except OSError:
            pass

        if rows:
            return jsonify( row_to_file_dict( rows[ 0 ] ) ), 201

        print( f"[FILES][!] Insert file failed and no duplicate found." )
        return jsonify( { "status" : "error" } ), 500

    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( user_id, sha256sum ),
    )

    file_row = rows[ 0 ]

    try:
        job = sqlite_queries.create_analysis_job_insert_tuple( file_id, model = model_id )
        if sqlite.insert_data( sqlite_queries.AnalysisJobs.insert_analysis_job, job ):
            sqlite.update_data(
                sqlite_queries.Files.update_file_status_by_id,
                ( "queued", file_id ),
            )
            rows = sqlite.query_database(
                sqlite_queries.Files.get_owned_file_by_sha256,
                ( user_id, sha256sum ),
            )
            file_row = rows[ 0 ]
    except Exception as e:
        # Upload succeeded; leave the sample pending if queueing could not run.
        print( f"[FILES][!] Auto-queue analysis failed for {sha256sum}. Error: ", e )

    return jsonify( row_to_file_dict( file_row ) ), 201


#
#   /api/files
#
@FILES_BP.route( "/files",  methods = [ "GET" ] )
@FILES_BP.route( "/files/", methods = [ "GET" ] )
@login_required
def list_files():
    """
    Endpoint:
        GET /api/files

    Returns:
        200 list of file dicts owned by the current user
    """
    try:
        rows = sqlite.query_database(
            sqlite_queries.Files.get_files_by_owner,
            ( g.current_user[ "id" ], ),
        )
    except sqlite3.Error as e:
        print( f"[FILES][!] List files failed. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    return jsonify( [ row_to_file_dict( r ) for r in rows ] ), 200


#
#   /api/file/<sha256>
#
@FILES_BP.route( "/file/<sha256>",  methods = [ "GET" ] )
@FILES_BP.route( "/file/<sha256>/", methods = [ "GET" ] )
@login_required
def get_file( sha256 : str ):
    """
    Endpoint:
        GET /api/file/<sha256>

    Returns:
        200 file dict
        404 not owned / not found
    """
    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( g.current_user[ "id" ], sha256 ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "File not found" } ), 404

    return jsonify( row_to_file_dict( rows[ 0 ] ) ), 200


@FILES_BP.route( "/file/<sha256>/report.md",  methods = [ "GET" ] )
@FILES_BP.route( "/file/<sha256>/report.md/", methods = [ "GET" ] )
@login_required
def download_file_report( sha256 : str ):
    """
    Endpoint:
        GET /api/file/<sha256>/report.md

    Returns:
        200 markdown attachment for owned completed report
        404 not owned / not found
        409 report not ready
    """
    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( g.current_user[ "id" ], sha256 ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "File not found" } ), 404

    return _markdown_report_response( rows[ 0 ] )


@FILES_BP.route( "/file/<sha256>",  methods = [ "DELETE" ] )
@FILES_BP.route( "/file/<sha256>/", methods = [ "DELETE" ] )
@login_required
def delete_file( sha256 : str ):
    """
    Endpoint:
        DELETE /api/file/<sha256>

    Returns:
        200 {"deleted": sha256}
        404 not owned / not found
    """
    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( g.current_user[ "id" ], sha256 ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "File not found" } ), 404

    file_row = rows[ 0 ]
    file_id  = file_row[ 0 ]
    filename = file_row[ 1 ] or ""

    _, ext = os.path.splitext( filename )
    ext = ext.lstrip( "." ) or "bin"

    try:
        os.remove( _disk_path( file_id, ext ) )
    except FileNotFoundError:
        pass
    except OSError as e:
        print( f"[FILES][!] Could not remove {file_id}.{ext} from disk. Error: ", e )

    try:
        sqlite.update_data(
            sqlite_queries.AnalysisJobs.delete_queued_job_by_file_id,
            ( file_id, ),
        )
        sqlite.update_data(
            sqlite_queries.Files.delete_file_by_id,
            ( file_id, ),
        )
    except sqlite3.Error as e:
        print( f"[FILES][!] Delete file row failed. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    return jsonify( { "deleted" : sha256 } ), 200


@FILES_BP.route( "/file/<sha256>/visibility",  methods = [ "PATCH" ] )
@FILES_BP.route( "/file/<sha256>/visibility/", methods = [ "PATCH" ] )
@login_required
def set_visibility( sha256 : str ):
    """
    Endpoint:
        PATCH /api/file/<sha256>/visibility

    Body (JSON):
        {"is_public": bool}

    Returns:
        200 updated file dict
        404 not owned / not found
        406 missing field
    """
    data : dict = request.get_json( silent = True ) or { }

    if "is_public" not in data:
        return jsonify( { "status" : "required fields not met" } ), 406

    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( g.current_user[ "id" ], sha256 ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "File not found" } ), 404

    file_id   = rows[ 0 ][ 0 ]
    is_public : bool = bool( data[ "is_public" ] )
    token      : str | None = str( uuid.uuid4() ) if is_public else None

    try:
        sqlite.update_data(
            sqlite_queries.Files.update_file_visibility_by_id,
            ( int( is_public ), token, file_id ),
        )
    except sqlite3.Error as e:
        print( f"[FILES][!] Update visibility failed. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( g.current_user[ "id" ], sha256 ),
    )

    return jsonify( row_to_file_dict( rows[ 0 ] ) ), 200


#
#   /api/public/file/<public_token>
#
@FILES_BP.route( "/public/file/<public_token>",  methods = [ "GET" ] )
@FILES_BP.route( "/public/file/<public_token>/", methods = [ "GET" ] )
def get_public_file( public_token : str ):
    """
    Endpoint:
        GET /api/public/file/<public_token>

    No auth.

    Returns:
        200 file dict
        404 not public / not found
    """
    rows = sqlite.query_database(
        sqlite_queries.Files.get_public_file_by_token,
        ( public_token, ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "File not found" } ), 404

    return jsonify( row_to_file_dict( rows[ 0 ], include_cost = False ) ), 200


@FILES_BP.route( "/public/file/<public_token>/report.md",  methods = [ "GET" ] )
@FILES_BP.route( "/public/file/<public_token>/report.md/", methods = [ "GET" ] )
def download_public_file_report( public_token : str ):
    """
    Endpoint:
        GET /api/public/file/<public_token>/report.md

    No auth. Requires a valid public token.

    Returns:
        200 markdown attachment for public completed report
        404 not public / not found
        409 report not ready
    """
    rows = sqlite.query_database(
        sqlite_queries.Files.get_public_file_by_token,
        ( public_token, ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "File not found" } ), 404

    return _markdown_report_response( rows[ 0 ] )
