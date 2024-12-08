import streamlit as st
import pandas as pd
import os

# Function to load data
def load_data(filename):
    try:
        
        # Debug point: Check if file exists
        if not os.path.exists(filename):
            st.error(f"File '{filename}' not found in the directory.")
            return pd.DataFrame()

        data = pd.read_csv(filename)

        # Debug point: File successfully loaded
        st.write(f"File loaded successfully. Shape: {data.shape}")
        return data
    except FileNotFoundError:
        st.error(f"File '{filename}' not found. Please ensure it is in the same directory as this script.")
        return pd.DataFrame()
    except pd.errors.ParserError as e:
        st.error(f"Error parsing file '{filename}': {e}")
        return pd.DataFrame()

# Load the CSV file
csv_file = "listings.csv"
data = load_data(csv_file)

st.title("Real Estate Dashboard")

# Initialize filtered_data
filtered_data = pd.DataFrame()

# Sidebar filters
st.sidebar.header("Filter Options")

cities = st.sidebar.multiselect("Select Cities", options=data["City"].unique(), default=data["City"].unique())
min_price = st.sidebar.number_input("Min Price ($)", min_value=0, value=500000, step=50000)
max_price = st.sidebar.number_input("Max Price ($)", min_value=0, value=650000, step=50000)

# Square footage filters
min_sqft = st.sidebar.number_input("Min Square Footage", min_value=0, value=800, step=100)
max_sqft = st.sidebar.number_input("Max Square Footage", min_value=0, value=3000, step=100)

# Add a button to stop the Streamlit server
if st.sidebar.button("Stop Server"):
    st.warning("Stopping the server...")
    os._exit(0)

# Ensure the columns exist before filtering
if "City" in data.columns and "Price" in data.columns and "Square Footage" in data.columns:
    data["Price (int)"] = data["Price"].str.replace("[$,]", "", regex=True).astype(float)
    data["Square Footage (int)"] = data["Square Footage"].astype(float)

    # Apply Filters
    filtered_data = data[
        (data["City"].isin(cities)) &
        (data["Price (int)"].between(min_price, max_price)) &
        (data["Square Footage (int)"].between(min_sqft, max_sqft))
    ]

    # Display the number of filtered listings in the sidebar
    st.sidebar.write(f"### Listings Found: {len(filtered_data)}")

    # Debug filtered data
    with st.expander("Show More"):
        st.write("### Filtered Data:", filtered_data)
else:
    st.error("One or more required columns (City, Price, Square Footage) are missing from the data.")
    filtered_data = pd.DataFrame()

# Show images and descriptions
if not filtered_data.empty:
    for _, row in filtered_data.iterrows():
        st.write(f"### {row['Street']}, {row['City']}, {row['Province']}")
        
        # Show property link
        st.write(f"[View Listing]({row['Link']})")
        # Display images
        cols = st.columns(4)
        for i, img in enumerate(["Image1", "Image2", "Image3", "Image4"]):
            if pd.notna(row[img]):
                with cols[i]:
                    st.image(row[img], use_container_width=True)
        # Show "Show More" for description
        with st.expander("Show More"):
            st.write(row["Description"])
else:
    st.warning("No properties match the selected filters.")
