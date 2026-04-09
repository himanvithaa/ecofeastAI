import streamlit as st
import folium
from streamlit_folium import st_folium
import math

# --- CONFIGURATION ---
st.set_page_config(page_title="EcoFeast AI - Redistribution Map", layout="wide")

# --- DATA ---
# Fixed Restaurant Location (The Source)
RESTAURANT = {
    "name": "EcoFeast Hub (Restaurant)",
    "lat": 12.9716, 
    "lon": 77.5946,
    "icon": "cutlery"
}

# NGO Locations (The Destinations)
NGOS = [
    {"name": "City Food Bank", "lat": 12.9850, "lon": 77.6100, "type": "NGO"},
    {"name": "Hope Orphanage", "lat": 12.9600, "lon": 77.5800, "type": "Orphanage"},
    {"name": "Green Earth Compost", "lat": 12.9900, "lon": 77.5700, "type": "Fertilizer Plant"}
]

# --- LOGIC: Calculate Distance ---
def haversine(lat1, lon1, lat2, lon2):
    """Calculate the great-circle distance between two points on Earth."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# Find the nearest NGO
nearest_ngo = None
min_dist = float('inf')

for ngo in NGOS:
    dist = haversine(RESTAURANT['lat'], RESTAURANT['lon'], ngo['lat'], ngo['lon'])
    ngo['distance'] = round(dist, 2)
    if dist < min_dist:
        min_dist = dist
        nearest_ngo = ngo

# --- UI: Streamlit App ---
st.title("📍 Autonomous Food Redistribution Map")
st.markdown("This demo shows how **EcoFeast AI** identifies the nearest partner for surplus food redistribution.")

col1, col2 = st.columns([3, 1])

with col1:
    # Create the Map
    m = folium.Map(location=[RESTAURANT['lat'], RESTAURANT['lon']], zoom_start=13, tiles="cartodbpositron")

    # Add Restaurant Marker
    folium.Marker(
        [RESTAURANT['lat'], RESTAURANT['lon']],
        popup=RESTAURANT['name'],
        tooltip=RESTAURANT['name'],
        icon=folium.Icon(color="green", icon="cutlery", prefix="fa")
    ).add_to(m)

    # Add NGO Markers
    for ngo in NGOS:
        is_nearest = (ngo == nearest_ngo)
        color = "blue" if not is_nearest else "red"
        
        folium.Marker(
            [ngo['lat'], ngo['lon']],
            popup=f"{ngo['name']} ({ngo['distance']} km)",
            tooltip=ngo['name'],
            icon=folium.Icon(color=color, icon="heart", prefix="fa")
        ).add_to(m)
        
        # Draw a line to the nearest NGO
        if is_nearest:
            folium.PolyLine(
                locations=[[RESTAURANT['lat'], RESTAURANT['lon']], [ngo['lat'], ngo['lon']]],
                color="red",
                weight=5,
                opacity=0.6,
                tooltip="Redistribution Path"
            ).add_to(m)

    # Display Map
    st_folium(m, width=800, height=500)

with col2:
    st.subheader("Redistribution Logic")
    st.info(f"**Source:** {RESTAURANT['name']}")
    
    st.success(f"**Nearest Partner Found!**")
    st.write(f"**Name:** {nearest_ngo['name']}")
    st.write(f"**Distance:** {nearest_ngo['distance']} km")
    
    st.warning("🚀 **Suggested Action:**")
    st.button("Send Surplus Food Here", use_container_width=True)
    
    st.divider()
    st.write("**Other Partners:**")
    for ngo in NGOS:
        if ngo != nearest_ngo:
            st.write(f"- {ngo['name']} ({ngo['distance']} km)")

# --- INSTRUCTIONS ---
# To run this code:
# 1. Install dependencies: pip install streamlit folium streamlit-folium
# 2. Save this file as `mapping_demo.py`
# 3. Run the app: streamlit run mapping_demo.py
