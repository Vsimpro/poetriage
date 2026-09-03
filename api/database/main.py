import os, sqlite3, threading


# Global Variables
CONNECTION = None
DB_LOCK = threading.RLock()


#SLOP
def _make_shared_path( path : str, mode : int ) -> None:
    try:
        os.chmod( path, mode )
    except OSError as error:
        raise RuntimeError( f"Poetriage data path is not writable by this runtime: {path}" ) from error


def table_exists(table_name: str) -> bool:
    with DB_LOCK:
        cursor = get_connection().cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND lower(name)=lower(?);",
            (table_name,)
        )
        return cursor.fetchone() is not None


def get_table_columns(table_name: str) -> list:
    with DB_LOCK:
        cursor = get_connection().cursor()
        cursor.execute(f"PRAGMA table_info({table_name});")
        return [row[1] for row in cursor.fetchall()]


def execute_statement(query: str, user_input: tuple | None = None) -> bool:
    try:
        with DB_LOCK:
            cursor = get_connection().cursor()
            if user_input is not None:
                cursor.execute(query, user_input)
            else:
                cursor.execute(query)
            get_connection().commit()
        return True
    except Exception as e:
        get_connection().rollback()
        print(f"[DATABASE] [!] Error running statement {query}, details: {e}")
        return False


def ensure_column(table_name: str, column_name: str, column_definition: str) -> bool:
    try:
        if column_name in get_table_columns(table_name):
            return True

        with DB_LOCK:
            cursor = get_connection().cursor()
            cursor.execute(
                f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition};"
            )
            get_connection().commit()
        print(f"[DATABASE] [+] Added column {column_name} to {table_name}")
        return True
    except Exception as e:
        get_connection().rollback()
        print(f"[DATABASE] [!] Error when adding column {column_name} to {table_name}, {e}")
        return False


def get_connection():
    global CONNECTION

    if CONNECTION is None:
        raise ConnectionError( "Database connection has not been initialized." )

    return CONNECTION


def get_tables() -> list:
    """
    #### Returns
    * list(): list of the table names in the DB.
    """
    global CONNECTION

    with DB_LOCK:
        cursor = get_connection().cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        return tables


def create_tables( tables : dict ) -> bool:
    """
    Create tables defined in the Tables dictionary.


    Parameters:
        dict : `tables` The dictionary should be of format 'name' -> 'query'

    Returns:
        bool: True on success, False on any error.
    """
    global CONNECTION

    try:
        with DB_LOCK:
            cursor = get_connection().cursor()

            for table_name in tables:
                # Check if table exists in the database
                if table_exists(table_name):
                    print( "[DATABASE] [+] Table exists: ", table_name )
                    continue

                #
                #   Create the table
                #
                cursor.execute( tables[ table_name ] )
                print( "[DATABASE] [+] Table: ", table_name, "created" )

            print( "[DATABASE] Ready." )
            get_connection().commit()
            cursor.close()

    except Exception as e:
        print( "[DATABASE] [!] Error when creating tables,", e )
        return False

    return True


def query_database( query : str, user_input : tuple | None = None ) -> list:
    """
    Run specified query in the Database.

    Parameters:
        str   : `query` the query to be ran agaisnt the DB.
        tuple : `user_input`: None, or the user specified parameters.

    Returns:
        list: the results of the query.
    """
    global CONNECTION
    rows : list = []

    try:
        with DB_LOCK:
            cursor = get_connection().cursor()

            if user_input:
                cursor.execute( query, user_input )

            else:
                cursor.execute( query )

            rows = cursor.fetchall()

    except Exception as e:
        print( f"[DATABASE] [!] Ran into an issue while running execute({ query }). Details: ", e )
        return []

    return rows


def insert_data( query : str, data ) -> bool:
    """
    Insert data into a table using premade queries.

    Parameters:
        str        : `query` the SQL insert query
        list,tuple : `data` the data to be inserted. Either as a tuple or as a list of tuples

    Returns:
        bool: Upon success
    """
    global CONNECTION

    try:
        with DB_LOCK:
            cursor = get_connection().cursor()

            # List of tuples
            if type(data) == list:
                cursor.executemany( query, data )
                get_connection().commit()

            # Single tuple
            if type(data) == tuple:
                cursor.execute( query, data )
                get_connection().commit()

    except Exception as e:
        get_connection().rollback()
        print( f"[DATABASE] [!] Ran into an issue while running execute({ query }), with data {data}, details: ", e )
        return False

    return True


def update_data( query : str, data ) -> bool:
    """
    Update data in a table using premade queries.

    Parameters
        str   : `query` the query to update the rows with
        tuple : `data` the data typle

    Returns:
        bool: Upon success
    """
    global CONNECTION

    try:
        with DB_LOCK:
            cursor = get_connection().cursor()
            if type(data) == tuple:
                cursor.execute( query, data )

            get_connection().commit()
            print( f"[DATABASE] [?] Rows updated: { cursor.rowcount }" )

    except Exception as e:
        get_connection().rollback()
        print( f"[DATABASE] [!] Ran into an issue while running execute({ query }), with data {data}, details: ", e )
        return False

    return True


def initialize_db( db_name : str = "database.db" ) -> bool:
    """
    Prepare the Database for use.

    Parameters:
        str : `db_name`, name of the SQLite database file.

    Returns:
        bool: Boolean upon success.
    """
    global CONNECTION

    db_exists = None

    try:
        print( "[>] Connecting to database.")

        db_dir = os.path.dirname( db_name )
        if db_dir:
            os.makedirs( db_dir, exist_ok = True )
            _make_shared_path( db_dir, 0o777 )

        db_exists = os.path.exists( db_name )
        if not db_exists:
            print("[>] Database file not found, creating new one.")
            with open( db_name, "w+" ) as file:
                file.write( "" )

        CONNECTION = sqlite3.connect( db_name, check_same_thread = False, timeout = 30 )
        _make_shared_path( db_name, 0o666 )
        print( "[>] Connection made " )

        print( "[>] Desired tables made." )

    except Exception as error:
        print(f"Error: {error}")
        return False

    return True
