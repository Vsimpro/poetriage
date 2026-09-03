"""
Bootstrap the database to enable local CLI runs.
"""

import os
import secrets

from werkzeug.security import generate_password_hash

from api.database import main as sqlite
from api.database import queries as sqlite_queries


def create_default_admin( admin_creds_file : str ) -> None:
    """Create and print the initial admin credentials when no users exist."""
    rows = sqlite.query_database( sqlite_queries.Users.count_users )

    if rows and rows[ 0 ][ 0 ] > 0:
        return

    username      = "admin"
    password      = secrets.token_urlsafe( 16 )
    password_hash = generate_password_hash( password )

    user = sqlite_queries.create_user_insert_tuple(
        username      = username,
        password_hash = password_hash,
        is_admin      = 1,
        is_active     = 1,
    )

    if not sqlite.insert_data( sqlite_queries.Users.insert_user, user ):
        print( "[APP][!] Could not create default admin." )
        return

    credentials = f"username={username}\npassword={password}\n"

    os.makedirs( os.path.dirname( admin_creds_file ) or ".", exist_ok = True )

    with open( admin_creds_file, "w" ) as file:
        file.write( credentials )

    os.chmod( admin_creds_file, 0o666 )

    print( "[APP][+] Default admin created." )
    print( "[APP][+] username: admin" )
    print( f"[APP][+] password: {password}" )
    print( f"[APP][+] credentials file: {admin_creds_file}" )
