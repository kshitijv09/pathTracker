"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  DirectionsRenderer,
} from "@react-google-maps/api";

// Define the map container styles
const mapContainerStyle = {
  width: "100%",
  height: "100vh",
};

// Define map options
const options = {
  zoomControl: true,
};

const MapComponent = () => {
  // State to store the path of waypoints
  const [path, setPath] = useState<google.maps.LatLngLiteral[]>([]);
  // State to store the map instance
  const [map, setMap] = useState<google.maps.Map | null>(null);
  // State to store the current vehicle position
  const [vehiclePosition, setVehiclePosition] =
    useState<google.maps.LatLngLiteral | null>(null);
  // State to store the directions result
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  // State to store user's current latitude
  const [userLat, setUserLat] = useState<number>(0);
  // State to store user's current longitude
  const [userLong, setUserLong] = useState<number>(0);
  // State to store the index of the current step in the route
  const [stepIndex, setStepIndex] = useState<number>(0);
  // State to manage the tracking status
  const [tracking, setTracking] = useState<boolean>(false);

  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Maps script
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  // Function to handle map clicks and add waypoints to the path
  const onMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    if (path.length === 0) {
      setVehiclePosition({ lat: userLat, lng: userLong });
      setPath((currentPath) => [
        ...currentPath,
        {
          lat: userLat,
          lng: userLong,
        },
      ]);
    }

    setPath((currentPath) => [
      ...currentPath,
      {
        lat: event.latLng!.lat(),
        lng: event.latLng!.lng(),
      },
    ]);
  };

  // Effect to fetch directions when path is updated
  useEffect(() => {
    if (path.length > 1) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: path[0],
          destination: path[path.length - 1],
          travelMode: google.maps.TravelMode.DRIVING,
          waypoints: path.slice(1, -1).map((point) => ({ location: point })),
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
          } else {
            console.error(`Error fetching directions ${result}`);
          }
        }
      );
    }
  }, [path]);

  // Function to start vehicle tracking
  const startTracking = () => {
    setTracking(true);
  };

  // Effect to handle vehicle movement based on the directions
  useEffect(() => {
    if (tracking) {
      // Function to update vehicle position with current user location
      const updateVehiclePosition = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        setVehiclePosition({ lat: latitude, lng: longitude });

        // Check if the vehicle is close to the destination
        if (directions) {
          const destination =
            directions.routes[0].legs[directions.routes[0].legs.length - 1]
              .end_location;
          const distance =
            google.maps.geometry.spherical.computeDistanceBetween(
              new google.maps.LatLng(latitude, longitude),
              destination
            );

          // Stop tracking if within a certain distance of the destination (e.g., 50 meters)
          if (distance < 50) {
            setTracking(false);
          }
        }
      };

      // Start a regular interval to update vehicle position
      intervalIdRef.current = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            updateVehiclePosition,
            (error) => {
              console.error("Error retrieving location:", error);
            }
          );
        } else {
          console.log("Geolocation is not supported by this browser.");
        }
      }, 3000);

      // Clear interval on cleanup
      return () => clearInterval(intervalIdRef.current!);
    }
  }, [tracking, directions]);

  // Function to get user's current location
  const getUserLocation = useCallback(() => {
    if (!isLoaded) return;

    const onSuccess = (location: GeolocationPosition) => {
      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;
      setUserLat(latitude);
      setUserLong(longitude);
    };

    const onError = (err: any) => {
      console.log("Error retrieving location:", err);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(onSuccess, onError);
    } else {
      console.log("Geolocation is not supported by this browser.");
    }
  }, [isLoaded]);

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={vehiclePosition || { lat: userLat, lng: userLong }} // Center the map on vehicle or user position
        zoom={15}
        options={options}
        onLoad={onLoad}
        onClick={onMapClick} // Add waypoint on map click
      >
        {path.map((position, idx) => (
          <Marker key={idx} position={position} title={`#${idx + 1}`} />
        ))}
        {vehiclePosition && (
          <Marker
            position={vehiclePosition}
            icon={{
              url: "car.png",
              scaledSize: new window.google.maps.Size(35, 35),
              anchor: new window.google.maps.Point(25, 25),
            }}
          />
        )}

        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#000000",
                strokeOpacity: 1.0,
                strokeWeight: 3,
                icons: [
                  {
                    icon: {
                      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    },
                    offset: "100%",
                    repeat: "33%",
                  },
                ],
              },
            }}
          />
        )}
      </GoogleMap>
      <button
        onClick={startTracking}
        disabled={tracking || !directions}
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        {tracking ? "Tracking..." : "Start Tracking"}
      </button>
    </div>
  );
};

export default MapComponent;
