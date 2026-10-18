# example usage of routing.py
import routing

coordinates = [ # correct input data format example (tile E20_N50)
    [20.944980, 50.064650],
    [20.936580, 50.061430],
    [20.950000, 50.055000],
]

# get route:
result = routing.path(coordinates)

# get GeoJSON and GPX separately:
route_json = result["json"]
route_gpx = result["gpx"]

# print results:
print(route_json)
print(route_gpx)

# save gpx text as a file:
# with open("output/test.gpx", "w", encoding="utf-8") as file:
#     file.write(route_gpx)
