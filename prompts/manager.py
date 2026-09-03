from pathlib import Path


class PromptManager:
    def __init__(self, prompt_dir = "prompts"):
        self.prompt_dir = Path( prompt_dir )


    def load( self, name : str ) -> str:
        return ( self.prompt_dir / name ).read_text( encoding = "utf-8" )


    def render( self, name : str, **values ) -> str:
        rendered = self.load( name ).format( **values )
        return rendered
    