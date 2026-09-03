from flask import Blueprint, jsonify

from api.endpoints import login_required
from src.model_settings import default_model, list_models


ENDPOINT  = "/api"
MODELS_BP = Blueprint( "models", __name__, url_prefix = ENDPOINT )


@MODELS_BP.route( "/models",  methods = [ "GET" ] )
@MODELS_BP.route( "/models/", methods = [ "GET" ] )
@login_required
def get_models():
    return jsonify({
        "default_model" : default_model(),
        "models"        : list_models( enabled_only = True ),
    }), 200
