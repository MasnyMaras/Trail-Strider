# example usage of routing.py
import routing

coordinates = [ # correct input data format example
    [19.935833, 49.307500],
    [19.934084, 49.251005],
    [19.980521, 49.269497],
    [19.949600, 49.299200],
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