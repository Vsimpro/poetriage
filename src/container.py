import docker
import io, tarfile
from pathlib import Path


def reset_container(
    container_name : str = "remnux-pi",
    image          : str = "remnux/remnux-distro@sha256:5198184099fb433631998f6a42799a823d9af60cebfcb84895f5c151f91956bc",
):
    client = docker.from_env()
    
    try:
        container = client.containers.get(container_name)
        container.remove(force=True)
    
    except docker.errors.NotFound:
        pass
    
    return client.containers.run(
        image,
        name        = container_name,
        tty         = True,
        detach      = True,
        auto_remove = False,
        labels      = {
            "poetriage.managed" : "true",
            "poetriage.role"    : "remnux-analysis",
        },
    )


def copy_to_container(
    source         : str | Path,
    container_name : str = "remnux-pi",
    dest_dir       : str = "/home/remnux/files/samples",
) -> str:
    
    source     = Path( source ).resolve()
    client     = docker.from_env()
    container  = client.containers.get( container_name )
    tar_stream = io.BytesIO()
    
    with tarfile.open( fileobj = tar_stream, mode = "w" ) as tar:
        tar.add( source, arcname = source.name )

    tar_stream.seek( 0 )
    container.exec_run(["mkdir", "-p", dest_dir])
    container.put_archive( dest_dir, tar_stream.read() )

    return f"{dest_dir.rstrip('/')}/{source.name}"