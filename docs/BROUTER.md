# Setup guide for local docker brouter image
This guide explains how to run BRouter locally using Docker Compose. It covers downloading routing data, configuring the service, starting the container, and testing a route.

## 1. Routing data directory
Navigate to the project directory:
```bash
cd ~/Trail-Strider
```
Create routing directory & get `.rd5` files e.g. with tile corner in 45°N 15°E (in Lesser Poland Voivodeship). 
Check if rd5 files got downloaded:
```bash
mkdir -p routing/segments4
wget -O routing/segments4/E20_N50.rd5 \https://brouter.de/brouter/segments4/E20_N50.rd5
```
BRouter uses `.rd5` files containing routing data for geographic areas measuring 5° × 5°. The tile name identifies the southwest corner of the area it covers.

Verify the downloaded file:
```bash
ls -lh routing/segments4/
```

Expected output contains the `.rd5` file name. (In this example: `E15_N45.rd5`)

## 2. Docker image
In main project directory:
```bash
docker compose config --quiet
```
If the configuration is valid, the command should finish without displaying an error.

To list the services defined in the Compose configuration, run:
```bash
docker compose config --services
```

Download the configured image, and start the service in the background:
```bash
docker compose pull brouter
docker compose up -d brouter
```

Check the container status and http connection:
```bash
docker compose ps
docker compose port brouter 17777
```
expected output:
```text
NAME                      IMAGE                              COMMAND                  SERVICE   CREATED             STATUS             PORTS
trail-strider-brouter-1   ghcr.io/abrensch/brouter:nightly   "/__cacert_entrypoin…"   brouter   time of creation    Up ...             127.0.0.1:17777->17777/tcp
127.0.0.1:17777
```

Check logs:
```bash
docker compose logs --tail=50 brouter
```
No errors should appear.

## 3. Routing test
Test the routing:
```bash
curl -i --get "http://localhost:17777/brouter" \
  --data-urlencode "lonlats=20.94498,50.06465|20.93658,50.06143" \
  --data-urlencode "profile=trekking" \
  --data-urlencode "alternativeidx=0" \
  --data-urlencode "format=geojson"
```
A successful request should return an HTTP status similar to:
```text
HTTP/1.1 200 OK
Content-Type: application/vnd.geo+json; charset=utf-8
```
The response body should contain valid GeoJSON, typically including a feature and a route geometry.

## 4 Starting and stopping brouter

Start brouter:
```bash
docker compose start brouter
```

or run brouter:
```bash
docker compose up -d brouter
```

Stop brouter:
```bash
docker compose stop brouter
```
