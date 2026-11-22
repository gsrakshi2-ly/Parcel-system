# Parcel-system# PAQSAFE website starter


Files:

- `index.html` — structure and pages

- `style.css` — responsive design, themes, glassmorphism, animation

- `script.js` — navigation, registry, settings, demo states, chart, Web Serial connection


## Run

Open `index.html` in Chrome or Edge for the UI. For Web Serial, use HTTPS (GitHub Pages) or localhost and close Arduino Serial Monitor first.


## Arduino serial format

The website listens at 9600 baud. Supported lines:

- JSON: `{"distance":12.5,"water":"dry"}`

- JSON: `{"distance_cm":12.5,"water_sensor":1}`

- CSV: `12.5,dry`

- CSV: `12.5,wet`


For CSV, first field is distance in cm, second field is water state (`dry`, `wet`, `0`, or `1`).

This parser is a starting point; match it to your Arduino output and calibrate thresholds in your own hardware code.


## Notes

- Sample parcels and status values are demo data and are labeled as such.

- Local registry, settings, and feedback are stored in this browser's localStorage.

- This is a student prototype; no server, account system, or remote notification service is included.