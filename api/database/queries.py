"""
 *  Database queries for Poetriage.
 *  This file has been massively slopped. Beware!
 *  -Vs1m, 03/2026
"""

import uuid
from datetime import datetime


class Users:
    create_users_table = """
    CREATE TABLE IF NOT EXISTS Users (
        id            TEXT      PRIMARY KEY,
        username      TEXT      UNIQUE NOT NULL,
        password_hash TEXT      NOT NULL,
        is_admin      INTEGER   DEFAULT 0,
        is_active     INTEGER   DEFAULT 1,
        remember_token_hash TEXT UNIQUE,
        remember_token_expires_at TIMESTAMP,
        created_at    TIMESTAMP NOT NULL
    );
    """

    insert_user = """
        INSERT INTO Users (
            id,
            username,
            password_hash,
            is_admin,
            is_active,
            created_at
        )
        VALUES (?,?,?,?,?,?);
    """

    get_user_by_id = """
        SELECT id, username, password_hash, is_admin, is_active, created_at
        FROM Users
        WHERE id = ?;
    """

    get_user_by_username = """
        SELECT id, username, password_hash, is_admin, is_active, created_at
        FROM Users
        WHERE username = ?;
    """

    get_all_users = """
        SELECT id, username, password_hash, is_admin, is_active, created_at
        FROM Users
        ORDER BY username COLLATE NOCASE ASC;
    """

    get_user_by_remember_token_hash = """
        SELECT id, username, password_hash, is_admin, is_active, created_at, remember_token_expires_at
        FROM Users
        WHERE remember_token_hash = ? AND remember_token_expires_at > ?;
    """

    count_users = """
        SELECT COUNT(*)
        FROM Users;
    """

    update_user_active = """
        UPDATE Users
        SET is_active = ?
        WHERE id = ?;
    """

    update_remember_token_by_id = """
        UPDATE Users
        SET remember_token_hash = ?, remember_token_expires_at = ?
        WHERE id = ?;
    """

    clear_remember_token_by_id = """
        UPDATE Users
        SET remember_token_hash = NULL, remember_token_expires_at = NULL
        WHERE id = ?;
    """

    clear_remember_token_by_hash = """
        UPDATE Users
        SET remember_token_hash = NULL, remember_token_expires_at = NULL
        WHERE remember_token_hash = ?;
    """


class Files:
    create_files_table = """
    CREATE TABLE IF NOT EXISTS Files (
        id            TEXT      PRIMARY KEY,
        filename      TEXT      NOT NULL,
        md5           TEXT      NOT NULL,
        sha256        TEXT      NOT NULL,
        size          INTEGER   NOT NULL,
        uploaded_at   TIMESTAMP NOT NULL,
        analysis      TEXT,
        status        TEXT      DEFAULT 'pending',
        token_count   INTEGER   DEFAULT 0,
        analysis_cost REAL      DEFAULT 0,
        owner_user_id TEXT,
        is_public     INTEGER   DEFAULT 0,
        public_token  TEXT      UNIQUE,
        analysis_json  TEXT,
        analysis_context_rot INTEGER DEFAULT 0,
        risk_score    INTEGER,
        analysis_tool_log TEXT,
        analysis_token_count INTEGER DEFAULT 0,
        summary_token_count INTEGER DEFAULT 0,
        final_conversation_token_count INTEGER,
        analysis_cost_complete INTEGER DEFAULT 1,
        UNIQUE(owner_user_id, sha256)
    );
    """

    insert_into_files = """
        INSERT INTO Files (
            id,
            filename,
            md5,
            sha256,
            size,
            uploaded_at,
            analysis,
            status,
            token_count,
            analysis_cost,
            owner_user_id,
            is_public,
            public_token
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);
    """

    insert_completed_file = """
        INSERT INTO Files (
            id,
            filename,
            md5,
            sha256,
            size,
            uploaded_at,
            analysis,
            status,
            token_count,
            analysis_cost,
            owner_user_id,
            is_public,
            public_token,
            analysis_json,
            analysis_context_rot,
            risk_score,
            analysis_tool_log,
            analysis_token_count,
            summary_token_count,
            final_conversation_token_count,
            analysis_cost_complete
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
    """

    get_files_by_owner = """
        SELECT id, filename, md5, sha256, size, uploaded_at, analysis, status, token_count, analysis_cost, owner_user_id, is_public, public_token, analysis_json, analysis_context_rot, risk_score, analysis_token_count, summary_token_count, final_conversation_token_count
        FROM Files
        WHERE owner_user_id = ?
        ORDER BY uploaded_at DESC;
    """

    get_owned_file_by_sha256 = """
        SELECT id, filename, md5, sha256, size, uploaded_at, analysis, status, token_count, analysis_cost, owner_user_id, is_public, public_token, analysis_json, analysis_context_rot, risk_score, analysis_token_count, summary_token_count, final_conversation_token_count
        FROM Files
        WHERE owner_user_id = ? AND sha256 = ?;
    """

    get_public_file_by_token = """
        SELECT id, filename, md5, sha256, size, uploaded_at, analysis, status, token_count, analysis_cost, owner_user_id, is_public, public_token, analysis_json, analysis_context_rot, risk_score, analysis_token_count, summary_token_count, final_conversation_token_count
        FROM Files
        WHERE public_token = ? AND is_public = 1;
    """

    get_owned_file_by_sha256_hash = """
        SELECT id, filename, md5, sha256, size, uploaded_at, analysis, status, token_count, analysis_cost, owner_user_id, is_public, public_token, analysis_json, analysis_context_rot, risk_score, analysis_token_count, summary_token_count, final_conversation_token_count
        FROM Files
        WHERE owner_user_id = ? AND sha256 = ?;
    """

    get_owned_file_by_md5 = """
        SELECT id, filename, md5, sha256, size, uploaded_at, analysis, status, token_count, analysis_cost, owner_user_id, is_public, public_token, analysis_json, analysis_context_rot, risk_score, analysis_token_count, summary_token_count, final_conversation_token_count
        FROM Files
        WHERE owner_user_id = ? AND md5 = ?;
    """

    update_file_analysis_by_id = """
        UPDATE Files
        SET analysis = ?
        WHERE id = ?;
    """

    update_file_status_by_id = """
        UPDATE Files
        SET status = ?
        WHERE id = ?;
    """

    update_file_filename_by_id = """
        UPDATE Files
        SET filename = ?
        WHERE id = ?;
    """

    start_file_analysis_by_id = """
        UPDATE Files
        SET status = ?, analysis = ?, token_count = ?, analysis_cost = ?, analysis_json = NULL, analysis_context_rot = 0, risk_score = NULL, analysis_tool_log = NULL, analysis_token_count = 0, summary_token_count = 0, final_conversation_token_count = NULL, analysis_cost_complete = 1
        WHERE id = ?;
    """

    update_file_token_count_by_id = """
        UPDATE Files
        SET token_count = ?
        WHERE id = ?;
    """

    update_file_analysis_metadata = """
        UPDATE Files
        SET status = ?, token_count = ?, analysis_cost = ?
        WHERE id = ?;
    """

    update_file_analysis_metrics_by_id = """
        UPDATE Files
        SET token_count = ?, analysis_token_count = ?, summary_token_count = ?, final_conversation_token_count = ?, analysis_cost = ?, analysis_cost_complete = ?
        WHERE id = ?;
    """

    update_file_structured_analysis_by_id = """
        UPDATE Files
        SET analysis_json = ?, analysis_context_rot = ?, risk_score = ?
        WHERE id = ?;
    """

    update_file_tool_log_by_id = """
        UPDATE Files
        SET analysis_tool_log = ?
        WHERE id = ?;
    """

    update_file_analysis_result_by_id = """
        UPDATE Files
        SET analysis = ?, status = ?, token_count = ?, analysis_token_count = ?, summary_token_count = ?, final_conversation_token_count = ?, analysis_cost = ?, analysis_cost_complete = ?, analysis_json = ?, analysis_context_rot = ?, risk_score = ?, analysis_tool_log = ?
        WHERE id = ?;
    """

    backfill_component_token_counts = """
        UPDATE Files
        SET analysis_token_count = token_count
        WHERE token_count > 0 AND analysis_token_count = 0 AND summary_token_count = 0;
    """

    update_file_visibility_by_id = """
        UPDATE Files
        SET is_public = ?, public_token = ?
        WHERE id = ?;
    """

    update_null_owner_ids = """
        UPDATE Files
        SET owner_user_id = ?
        WHERE owner_user_id IS NULL;
    """

    count_unowned_files = """
        SELECT COUNT(*)
        FROM Files
        WHERE owner_user_id IS NULL;
    """

    get_active_analysis_for_user = """
        SELECT id, filename
        FROM Files
        WHERE status = 'analyzing' AND owner_user_id = ?
        LIMIT 1;
    """

    get_any_active_analysis = """
        SELECT id, filename, owner_user_id
        FROM Files
        WHERE status = 'analyzing'
        ORDER BY uploaded_at DESC
        LIMIT 1;
    """

    get_stuck_analyses = """
        SELECT id, filename, owner_user_id
        FROM Files
        WHERE status = 'analyzing';
    """

    delete_file_by_id = """
        DELETE FROM Files
        WHERE id = ?;
    """


class AnalysisJobs:
    create_analysis_jobs_table = """
    CREATE TABLE IF NOT EXISTS AnalysisJobs (
        id          TEXT      PRIMARY KEY,
        file_id     TEXT      NOT NULL,
        status      TEXT      NOT NULL,
        worker_id   TEXT,
        error       TEXT,
        model       TEXT,
        created_at  TIMESTAMP NOT NULL,
        started_at  TIMESTAMP,
        finished_at TIMESTAMP
    );
    """

    insert_analysis_job = """
        INSERT INTO AnalysisJobs (
            id,
            file_id,
            status,
            worker_id,
            error,
            model,
            created_at,
            started_at,
            finished_at
        )
        VALUES (?,?,?,?,?,?,?,?,?);
    """

    get_active_job_by_file_id = """
        SELECT id, file_id, status, worker_id, error, created_at, started_at, finished_at, model
        FROM AnalysisJobs
        WHERE file_id = ? AND status IN ('queued', 'running')
        ORDER BY created_at ASC
        LIMIT 1;
    """

    claim_oldest_queued_job = """
        UPDATE AnalysisJobs
        SET status = 'running', worker_id = ?, started_at = ?
        WHERE id = (
            SELECT id
            FROM AnalysisJobs
            WHERE status = 'queued'
            ORDER BY created_at ASC
            LIMIT 1
        );
    """

    get_running_job_by_worker_id = """
        SELECT id, file_id, status, worker_id, error, created_at, started_at, finished_at, model
        FROM AnalysisJobs
        WHERE status = 'running' AND worker_id = ?
        ORDER BY started_at DESC
        LIMIT 1;
    """

    finish_job_by_id = """
        UPDATE AnalysisJobs
        SET status = ?, error = ?, finished_at = ?
        WHERE id = ?;
    """

    delete_queued_job_by_file_id = """
        DELETE FROM AnalysisJobs
        WHERE file_id = ? AND status = 'queued';
    """

    get_latest_job_by_file_id = """
        SELECT created_at, started_at, finished_at
        FROM AnalysisJobs
        WHERE file_id = ?
        ORDER BY created_at DESC
        LIMIT 1;
    """

    get_latest_model_by_file_id = """
        SELECT model
        FROM AnalysisJobs
        WHERE file_id = ? AND model IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1;
    """

    count_jobs_by_status = """
        SELECT status, COUNT(*)
        FROM AnalysisJobs
        WHERE status IN ('queued', 'running')
        GROUP BY status;
    """

    get_current_running_file = """
        SELECT Files.filename
        FROM AnalysisJobs
        JOIN Files ON Files.id = AnalysisJobs.file_id
        WHERE AnalysisJobs.status = 'running'
        ORDER BY AnalysisJobs.started_at ASC
        LIMIT 1;
    """

    get_job_file_by_id = """
        SELECT Files.id, Files.filename, Files.md5, Files.sha256, Files.size, Files.uploaded_at, Files.analysis, Files.status, Files.token_count, Files.analysis_cost, Files.owner_user_id, Files.is_public, Files.public_token, Files.analysis_json, Files.analysis_context_rot, Files.risk_score, Files.analysis_token_count, Files.summary_token_count, Files.final_conversation_token_count
        FROM AnalysisJobs
        JOIN Files ON Files.id = AnalysisJobs.file_id
        WHERE AnalysisJobs.id = ?;
    """


class AllowedModels:
    create_allowed_models_table = """
    CREATE TABLE IF NOT EXISTS AllowedModels (
        id          TEXT      PRIMARY KEY,
        model_id    TEXT      UNIQUE NOT NULL,
        label       TEXT,
        is_enabled  INTEGER   DEFAULT 1,
        tags        TEXT,
        created_at  TIMESTAMP NOT NULL,
        updated_at  TIMESTAMP NOT NULL
    );
    """

    insert_model = """
        INSERT OR IGNORE INTO AllowedModels (
            id,
            model_id,
            label,
            is_enabled,
            tags,
            created_at,
            updated_at
        )
        VALUES (?,?,?,?,?,?,?);
    """

    get_all_models = """
        SELECT id, model_id, label, is_enabled, tags, created_at, updated_at
        FROM AllowedModels
        ORDER BY label COLLATE NOCASE ASC, model_id COLLATE NOCASE ASC;
    """

    get_enabled_models = """
        SELECT id, model_id, label, is_enabled, tags, created_at, updated_at
        FROM AllowedModels
        WHERE is_enabled = 1
        ORDER BY label COLLATE NOCASE ASC, model_id COLLATE NOCASE ASC;
    """

    get_model_by_model_id = """
        SELECT id, model_id, label, is_enabled, tags, created_at, updated_at
        FROM AllowedModels
        WHERE model_id = ?;
    """

    update_model = """
        UPDATE AllowedModels
        SET label = ?, is_enabled = ?, tags = ?, updated_at = ?
        WHERE id = ?;
    """

    count_enabled_models = """
        SELECT COUNT(*)
        FROM AllowedModels
        WHERE is_enabled = 1;
    """


class AppSettings:
    create_app_settings_table = """
    CREATE TABLE IF NOT EXISTS AppSettings (
        key        TEXT      PRIMARY KEY,
        value      TEXT,
        is_secret  INTEGER   DEFAULT 0,
        updated_at TIMESTAMP NOT NULL
    );
    """

    insert_setting_if_missing = """
        INSERT OR IGNORE INTO AppSettings (
            key,
            value,
            is_secret,
            updated_at
        )
        VALUES (?,?,?,?);
    """

    get_all_settings = """
        SELECT key, value, is_secret, updated_at
        FROM AppSettings;
    """

    get_setting_by_key = """
        SELECT key, value, is_secret, updated_at
        FROM AppSettings
        WHERE key = ?;
    """

    update_setting = """
        UPDATE AppSettings
        SET value = ?, is_secret = ?, updated_at = ?
        WHERE key = ?;
    """

    upsert_setting = """
        INSERT INTO AppSettings (
            key,
            value,
            is_secret,
            updated_at
        )
        VALUES (?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            is_secret = excluded.is_secret,
            updated_at = excluded.updated_at;
    """

def create_user_insert_tuple(
    username: str,
    password_hash: str,
    is_admin: int = 0,
    is_active: int = 1
) -> tuple:
    return (
        str(uuid.uuid4()),
        username,
        password_hash,
        is_admin,
        is_active,
        datetime.now().isoformat()
    )


def create_file_insert_tuple(
    filename: str,
    md5: str,
    sha256: str,
    size: int,
    owner_user_id: str,
    file_id: str | None = None,
    analysis=None,
    status=None,
    token_count: int = 0,
    analysis_cost: float = 0.0,
    is_public: int = 0,
    public_token: str | None = None
) -> tuple:
    return (
        file_id or str(uuid.uuid4()),
        filename,
        md5,
        sha256,
        size,
        datetime.now().isoformat(),
        analysis,
        status,
        token_count,
        analysis_cost,
        owner_user_id,
        is_public,
        public_token
    )


#SLOP
def create_analysis_job_insert_tuple(
    file_id : str,
    job_id  : str | None = None,
    status  : str = "queued",
    model   : str | None = None,
) -> tuple:
    """
    Build an AnalysisJobs insert tuple.

    Args:
        file_id (str)        : Files.id value this job should analyze.
        job_id  (str | None) : Optional caller-supplied job id.
        status  (str)        : Initial job status.
        model   (str | None) : Frozen model id for this analysis.

    Returns:
        tuple : Parameters for AnalysisJobs.insert_analysis_job.
    """
    return (
        job_id or str(uuid.uuid4()),
        file_id,
        status,
        None,
        None,
        model,
        datetime.now().isoformat(),
        None,
        None,
    )


def create_allowed_model_insert_tuple(
    model_id   : str,
    label      : str | None = None,
    tags       : str = "[]",
    is_enabled : int = 1,
) -> tuple:
    now = datetime.now().isoformat()
    return (
        str(uuid.uuid4()),
        model_id,
        label or model_id,
        is_enabled,
        tags,
        now,
        now,
    )
