\timing on
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS points_name_search_trgm_idx
    ON points USING gin (
        (translate(lower(
            coalesce(
                nullif(btrim(tags->>'name'), ''),
                nullif(btrim(tags->>'name:pl'), ''),
                nullif(btrim(tags->>'name:en'), '')
            )),
            'ąćęłńóśźżăâîșț',
            'acelnoszzaaist'
        )) gin_trgm_ops
    );
CREATE INDEX IF NOT EXISTS lines_name_search_trgm_idx
    ON lines USING gin (
        (translate(lower(
            coalesce(
                nullif(btrim(tags->>'name'), ''),
                nullif(btrim(tags->>'name:pl'), ''),
                nullif(btrim(tags->>'name:en'), '')
            )),
            'ąćęłńóśźżăâîșț',
            'acelnoszzaaist'
        )) gin_trgm_ops
    );
CREATE INDEX IF NOT EXISTS polygons_name_search_trgm_idx
    ON polygons USING gin (
        (translate(lower(
            coalesce(
                nullif(btrim(tags->>'name'), ''),
                nullif(btrim(tags->>'name:pl'), ''),
                nullif(btrim(tags->>'name:en'), '')
            )),
            'ąćęłńóśźżăâîșț',
            'acelnoszzaaist'
        )) gin_trgm_ops
    );
CREATE INDEX IF NOT EXISTS routes_name_search_trgm_idx
    ON routes USING gin (
        (translate(lower(
            coalesce(
                nullif(btrim(tags->>'name'), ''),
                nullif(btrim(tags->>'name:pl'), ''),
                nullif(btrim(tags->>'name:en'), '')
            )),
            'ąćęłńóśźżăâîșț',
            'acelnoszzaaist'
        )) gin_trgm_ops
    );

CREATE INDEX IF NOT EXISTS miejsca_name_search_trgm_idx
    ON app.miejsca USING gin (
        (translate(lower(btrim(nazwa)), 'ąćęłńóśźżăâîșț', 'acelnoszzaaist')) gin_trgm_ops
    );
CREATE INDEX IF NOT EXISTS noclegi_name_search_trgm_idx
    ON app.noclegi USING gin (
        (translate(lower(btrim(nazwa)), 'ąćęłńóśźżăâîșț', 'acelnoszzaaist')) gin_trgm_ops
    );
CREATE INDEX IF NOT EXISTS trails_name_search_trgm_idx
    ON app.trails USING gin (
        (translate(lower(btrim(name)), 'ąćęłńóśźżăâîșț', 'acelnoszzaaist')) gin_trgm_ops
    );

COMMIT;
