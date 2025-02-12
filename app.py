from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from datetime import datetime, timedelta
import os
import logging
import calendar
from dotenv import load_dotenv

# Connect .env file
load_dotenv()

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# DB Config
DB_HOST = os.getenv('DB_HOST', 'your-db-host')
DB_USERNAME = os.getenv('DB_USERNAME', 'your-db-username')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'your-db-password')
DB_NAME = os.getenv('DB_NAME', 'your-db-name')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Model Cuaca 
class Cuaca(db.Model):
    __tablename__ = 'your-table'
    id = db.Column(db.Integer, primary_key=True)
    kab = db.Column(db.String(100))
    provinsi = db.Column(db.String(100))
    awan = db.Column(db.String(100))
    kode_provinsi = db.Column(db.Integer)
    range_suhu = db.Column(db.String(50))
    suhu_min = db.Column(db.Integer)
    suhu_max = db.Column(db.Integer)
    date_time = db.Column(db.Date)
    kelembapan_min = db.Column(db.Integer)
    kelembapan_max = db.Column(db.Integer)
    kelembapanan_max = db.Column(db.Integer)
    url = db.Column(db.String(255))
    date_created = db.Column(db.DateTime)

# Week Order
week_order = ['Sabtu', 'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']

# Translate weekdays to Indonesian
indonesian_weekdays = {
    'Monday': 'Senin',
    'Tuesday': 'Selasa',
    'Wednesday': 'Rabu',
    'Thursday': 'Kamis',
    'Friday': 'Jumat',
    'Saturday': 'Sabtu',
    'Sunday': 'Minggu'
}

# Weather Icon mapping
condition_icon_map = {
    "Hujan Ringan": "chance_of_rain.png",
    "Berawan": "cloudy.png",
    "Udara Kabur": "haze.png",
    "Hujan Petir": "thunderstorm.png",
    "Hujan Sedang": "light_rain.png",
    "Kabut/Asap": "smoke.png",
    "Petir": "storm.png",
    "Cerah Berawan": "partly_sunny.png",
    "Cerah": "sunny.png",
    "Hujan Lebat": "rain.png",
}

def load_weather_data_from_db(selected_city=None, base_date=None):
    weather = {}
    try:
        # If no base date is provided, use today; otherwise parse the provided date.
        if base_date is None:
            base_date = datetime.today().date()
        else:
            try:
                base_date = datetime.strptime(base_date, '%Y-%m-%d').date()
            except Exception as e:
                logger.error(f"Invalid base_date format: {base_date}, error: {e}")
                base_date = datetime.today().date()

        # Calculate the week range based on base_date.
        # We determine "Sabtu" (Saturday) as the start of the week.
        sabtu = base_date - timedelta(days=(base_date.weekday() - 5) % 7)
        week_start = sabtu
        week_end = week_start + timedelta(days=6)

        logger.info(f"Fetching weather data from {week_start} to {week_end} (base_date: {base_date})")

        # Base query for the week
        query = Cuaca.query.with_entities(
            Cuaca.kab.label('kab'),
            Cuaca.date_time.label('date_time'),
            Cuaca.suhu_min.label('suhu_min'),
            Cuaca.suhu_max.label('suhu_max'),
            Cuaca.kelembapan_min.label('kelembapan_min'),
            Cuaca.kelembapanan_max.label('kelembapan_max'),
            Cuaca.awan.label('awan')
        ).filter(
            Cuaca.date_time >= week_start,
            Cuaca.date_time <= week_end
        )

        if selected_city:
            query = query.filter(Cuaca.kab == selected_city)

        records = query.order_by(Cuaca.date_time.asc()).all()
        logger.info(f"Fetched {len(records)} records from the database.")

        for record in records:
            try:
                city = record.kab.strip()
                date = record.date_time
                weekday_en = calendar.day_name[date.weekday()]
                weekday = indonesian_weekdays.get(weekday_en, weekday_en)
                # Format date as "dd Mon yyyy", e.g., "08 Jan 2025"
                date_str = date.strftime("%d %b %Y")

                high_temp = record.suhu_max
                low_temp = record.suhu_min
                condition = record.awan.strip()
                kelembapan_min = record.kelembapan_min
                kelembapan_max = record.kelembapan_max

                logger.info(f"Processing record: {city} on {weekday} ({date_str}), "
                            f"High: {high_temp}°C, Low: {low_temp}°C, Condition: {condition}, "
                            f"Humidity Min: {kelembapan_min}%, Humidity Max: {kelembapan_max}%")

                if city not in weather:
                    weather[city] = []

                weather[city].append({
                    "date": date_str,
                    "date_iso": date.isoformat(),
                    "weekday": weekday,
                    "high_temp": high_temp,
                    "low_temp": low_temp,
                    "condition": condition,
                    "humidity_min": kelembapan_min,
                    "humidity_max": kelembapan_max,
                    "icon": condition_icon_map.get(condition, "default.png")
                })
            except Exception as e:
                logger.error(f"Error processing record {record}: {e}")

        # For each city, fill in missing days with default N/A values.
        for city in weather:
            current_dates = set(item['date'] for item in weather[city])
            filled_data = weather[city].copy()
            for i in range(7):
                target_date = week_start + timedelta(days=i)
                target_date_str = target_date.strftime("%d %b %Y")
                target_date_iso = target_date.isoformat()
                target_weekday_en = calendar.day_name[target_date.weekday()]
                target_weekday = indonesian_weekdays.get(target_weekday_en, target_weekday_en)
                if target_date_str not in current_dates:
                    filled_data.append({
                        "date": target_date_str,
                        "date_iso": target_date_iso,
                        "weekday": target_weekday,
                        "high_temp": "N/A",
                        "low_temp": "N/A",
                        "condition": "N/A",
                        "humidity_min": "N/A",
                        "humidity_max": "N/A",
                        "icon": "default.png"
                    })
            filled_data.sort(key=lambda x: week_order.index(x['weekday']) if x['weekday'] in week_order else 7)
            weather[city] = filled_data

        # If no records were found for the selected city, create a full week of N/A data.
        if selected_city and selected_city not in weather:
            logger.info(f"No records found for {selected_city}. Populating with default N/A values.")
            filled_data = []
            for i in range(7):
                target_date = week_start + timedelta(days=i)
                target_date_str = target_date.strftime("%d %b %Y")
                target_date_iso = target_date.isoformat()
                target_weekday_en = calendar.day_name[target_date.weekday()]
                target_weekday = indonesian_weekdays.get(target_weekday_en, target_weekday_en)
                filled_data.append({
                    "date": target_date_str,
                    "date_iso": target_date_iso,
                    "weekday": target_weekday,
                    "high_temp": "N/A",
                    "low_temp": "N/A",
                    "condition": "N/A",
                    "humidity_min": "N/A",
                    "humidity_max": "N/A",
                    "icon": "default.png"
                })
            weather[selected_city] = filled_data

    except Exception as e:
        logger.error(f"Error fetching data from database: {e}")

    return weather

@app.route('/')
def index():
    # Get distinct cities from the database.
    cities_query = Cuaca.query.with_entities(Cuaca.kab).distinct().all()
    cities = sorted([record.kab for record in cities_query])
    logger.info(f"Available cities: {cities}")
    selected_city = request.args.get('city', None)
    if not selected_city or selected_city not in cities:
        selected_city = cities[0] if cities else None
        logger.info(f"Selected city not provided or invalid. Defaulting to: {selected_city}")

    # Use today's date (in ISO) for initial load.
    today_iso = datetime.today().date().isoformat()
    weather_data = load_weather_data_from_db(selected_city, base_date=today_iso)

    if not weather_data or selected_city not in weather_data:
        logger.error("Selected city is invalid or not found.")
        return render_template('index.html', cities=cities, selected_city=None, data=[], current_weather={}, selected_date=None)

    city_weather = weather_data[selected_city]
    logger.info(f"Loaded weather data for city: {selected_city}")

    today_str = datetime.today().date().strftime("%d %b %Y")
    selected_weather = next((item for item in city_weather if item["date"] == today_str), None)
    if not selected_weather:
        selected_weather = city_weather[0]
        logger.warning(f"Today's date {today_str} not found in forecast. Defaulting to: {selected_weather['date']}")
    else:
        logger.info(f"Today's weather data selected: {selected_weather['date']}")

    selected_date = selected_weather["date"]

    return render_template(
        'index.html',
        cities=cities,
        selected_city=selected_city,
        data=city_weather,
        current_weather=selected_weather,
        selected_date=selected_date
    )

@app.route('/api/weather')
def get_weather():
    city = request.args.get('city')
    base_date = request.args.get('date')  # Optional parameter from the client (YYYY-MM-DD)
    if not city:
        return jsonify({"error": "City parameter is required"}), 400

    weather_data = load_weather_data_from_db(city, base_date)
    if city not in weather_data:
        return jsonify({"error": "City not found"}), 404

    city_weather = weather_data[city]
    # Select the forecast item corresponding to the base_date (or today if not provided)
    if base_date is None:
        base_date_obj = datetime.today().date()
    else:
        try:
            base_date_obj = datetime.strptime(base_date, '%Y-%m-%d').date()
        except Exception:
            base_date_obj = datetime.today().date()
    base_date_str = base_date_obj.strftime("%d %b %Y")
    current_weather = next((item for item in city_weather if item["date"] == base_date_str), None)
    if not current_weather:
        current_weather = city_weather[0]

    response = {
        "current_weather": current_weather,
        "forecast": city_weather
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)
