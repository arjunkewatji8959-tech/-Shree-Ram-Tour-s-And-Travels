# Shree Ram Tours & Travels — Railway Single-Folder Project

## Run
1. Open this folder in VS Code.
2. `npm install`
3. `npm start`
4. Open `http://localhost:3000`

Do not use VS Code Live Server for the booking/auth flow because the Node/Express API is required.

## Customer flow
- Customer must Register/Login before booking.
- Customer login token is used for booking creation.
- Customer Account shows Book Now, Track Booking and My Bookings.
- Each booking has View Details and Track Trip.
- Owner can see registered customers and all booking details.

## Owner
- Owner login: `/owner-login`
- Initial password: `895987`
- Dashboard shows bookings, ongoing, upcoming, cancelled, completed and payment counts.
- Owner can set a booking to Pending, Confirmed, Ongoing, Completed or Cancelled.
- Owner can open View and Track for every booking.
- Owner can see registered clients in Customers.

## Data files
`bookings.json`, `customers.json`, and `enquiries.json` are in the same project root for Railway single-folder deployment.

For production on Railway, use a persistent Volume if you want JSON data to survive redeploys/restarts, or migrate storage to a database.
