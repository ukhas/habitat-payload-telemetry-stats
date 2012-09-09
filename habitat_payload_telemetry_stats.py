# Copyright (c) 2012 Daniel Richman. GNU GPL 3
# Views for habitat-payload-telemetry-stats

from habitat.utils.rfc3339 import rfc3339_to_timestamp
from couch_named_python import version

def _is_flight_telemetry(doc):
    return doc['type'] == "payload_telemetry" and \
        doc.get('data', {}).get('_parsed', {}).get('flight', False)

@version(1)
def receiver_map(doc):
    """
    View: ``payload_telemetry_stats/receiver``

    Emits::

        receiver callsign -> 1

    for every receiver of every payload_telemetry doc that belongs to a
    flight (not a testing payload).

    N.B.: reduce is "_sum" (Erlang)
    """

    if not _is_flight_telemetry(doc):
        return

    for callsign in doc['receivers']:
        yield callsign, 1

@version(1)
def flight_receiver_map(doc):
    """
    View: ``payload_telemetry_stats/flight_receiver``

    Emits::

        [flight id, receiver callsign] -> 1

    for every receiver of every payload_telemetry doc that belongs to a
    flight (not a testing payload).

    N.B.: reduce is "_sum" (Erlang)
    """

    if not _is_flight_telemetry(doc):
        return

    for callsign in doc['receivers']:
        yield (doc['data']['_parsed']['flight'], callsign), 1

@version(1)
def time_uploaded_day_map(doc):
    """
    View: ``payload_telemetry_stats/time_uploaded_day``

    Emits::

        (time_created // (3600 * 24)) -> 1

    for every receiver of every payload_telemetry doc that belongs to a
    flight (not a testing payload).

    N.B.: reduce is "_sum" (Erlang)
    """

    if not _is_flight_telemetry(doc):
        return

    for info in doc['receivers'].itervalues():
        t = rfc3339_to_timestamp(info["time_created"])
        yield (int(t // (3600 * 24)), callsign), 1

@version(1)
def launch_time_map(doc):
    """
    View: ``payload_telemetry_stats/launch_time```

    Emits::

        launch_time -> {flight}

    for every approved flight, where {flight} is a flight-like doc
    containing only flight['name'] and flight['launch']['time']
    """

    if doc['type'] == 'flight' and doc['approved']:
        t = rfc3339_to_timestamp(doc['launch']['time'])
        d = {"name": doc['name']}
        yield t, d
