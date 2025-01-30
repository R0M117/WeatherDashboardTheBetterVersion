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
DB_HOST = os.getenv('DB_HOST', 'srv610.hstgr.io')
DB_USERNAME = os.getenv('DB_USERNAME', 'u385006994_freelance')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'FredbAc3s5')
DB_NAME = os.getenv('DB_NAME', 'u385006994_databoks')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# model Cuaca 
class Cuaca(db.Model):
    __tablename__ = 'cuaca_kabkota_new' 
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

# Translate
indonesian_weekdays = {
    'Monday': 'Senin',
    'Tuesday': 'Selasa',
    'Wednesday': 'Rabu',
    'Thursday': 'Kamis',
    'Friday': 'Jumat',
    'Saturday': 'Sabtu',
    'Sunday': 'Minggu'
}

# Weather Icon
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

def load_weather_data_from_db(selected_city=None):
    weather = {}
    try:
        today = datetime.today().date()
        sabtu = today - timedelta(days=(today.weekday() - 5) % 7)  # Sabtu == 5
        week_start = sabtu
        week_end = week_start + timedelta(days=6)

        logger.info(f"Fetching weather data from {week_start} to {week_end}")

        # base query
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

        # Select City
        if selected_city:
            query = query.filter(Cuaca.kab == selected_city)

        records = query.order_by(Cuaca.date_time.asc()).all()
        
        logger.info(f"Fetched {len(records)} records from the database.")

        for record in records:
            try:
                city = record.kab.strip()
                date = record.date_time
                weekday_en = calendar.day_name[date.weekday()]  # Sesuaikan Date dgn Hari
                weekday = indonesian_weekdays.get(weekday_en, weekday_en)  # Translate ke Indo
                date_str = date.strftime("%d/%m/%Y")  # Convert --> "DD/MM/YYYY"

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

        # Untuk hari
        for city in weather:
            current_dates = set(item['date'] for item in weather[city])
            filled_data = weather[city].copy()

            # Iterasi Hari
            for i in range(7):
                target_date = week_start + timedelta(days=i)
                target_date_str = target_date.strftime("%d/%m/%Y")
                target_weekday_en = calendar.day_name[target_date.weekday()]
                target_weekday = indonesian_weekdays.get(target_weekday_en, target_weekday_en)

                if target_date_str not in current_dates:
                    # MisVal
                    filled_data.append({
                        "date": target_date_str,
                        "weekday": target_weekday,
                        "high_temp": "N/A",
                        "low_temp": "N/A",
                        "condition": "N/A",
                        "humidity_min": "N/A",
                        "humidity_max": "N/A",
                        "icon": "default.png"
                    })

            # Sort/urut dgn week order
            filled_data.sort(key=lambda x: week_order.index(x['weekday']) if x['weekday'] in week_order else 7)

            weather[city] = filled_data

    except Exception as e:
        logger.error(f"Error fetching data from database: {e}")

    return weather

@app.route('/')
def index():
    # unique cities
    cities_query = Cuaca.query.with_entities(Cuaca.kab).distinct().all()
    cities = sorted([record.kab for record in cities_query])
    logger.info(f"Available cities: {cities}")
    selected_city = request.args.get('city', None)
    if not selected_city or selected_city not in cities:
        selected_city = cities[0] if cities else None
        logger.info(f"Selected city not provided or invalid. Defaulting to: {selected_city}")

    weather_data = load_weather_data_from_db(selected_city)

    if not weather_data or selected_city not in weather_data:
        logger.error("Selected city is invalid or not found.")
        return render_template('index.html', cities=cities, selected_city=None, data=[], current_weather={}, selected_date=None)

    city_weather = weather_data[selected_city]
    logger.info(f"Loaded weather data for city: {selected_city}")

    # Date
    today = datetime.today().date()
    today_str = today.strftime("%d/%m/%Y")

    #  Forecast item
    selected_weather = next((item for item in city_weather if item["date"] == today_str and item["high_temp"] != "N/A"), None)

    if not selected_weather:
        selected_weather = next((item for item in city_weather if item["high_temp"] != "N/A"), None)
        if not selected_weather:
            selected_weather = city_weather[0]
        selected_date = selected_weather["date"]
        logger.warning(f"Today's data not found. Defaulting to: {selected_date}")
    else:
        selected_date = selected_weather["date"]
        logger.info(f"Today's weather data selected: {selected_date}")

    logger.info(f"Current Weather Data: {selected_weather}")

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
    if not city:
        return jsonify({"error": "City parameter is required"}), 400

    weather_data = load_weather_data_from_db(city)

    if city not in weather_data:
        return jsonify({"error": "City not found"}), 404

    city_weather = weather_data[city]

    # current weather
    today = datetime.today().date()
    today_str = today.strftime("%d/%m/%Y")
    current_weather = next((item for item in city_weather if item["date"] == today_str and item["high_temp"] != "N/A"), None)

    if not current_weather:
        current_weather = next((item for item in city_weather if item["high_temp"] != "N/A"), None)
        if not current_weather:
            current_weather = city_weather[0]

    response = {
        "current_weather": current_weather,
        "forecast": city_weather
    }

    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)
