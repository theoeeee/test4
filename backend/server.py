from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import qrcode
import io
import base64
import json
import asyncio
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'delivery_tracker')]

# Helper to convert MongoDB documents
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id':
                continue  # Skip MongoDB _id
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(v) if isinstance(v, dict) else v for v in value]
            else:
                result[key] = value
        return result
    return doc

# Create the main app
app = FastAPI(title="SiteTrack - Suivi de Livreurs")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.admin_connections: List[WebSocket] = []

    async def connect_driver(self, websocket: WebSocket, driver_id: str):
        await websocket.accept()
        self.active_connections[driver_id] = websocket
        logger.info(f"Driver {driver_id} connected")

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_connections.append(websocket)
        logger.info("Admin connected")

    def disconnect_driver(self, driver_id: str):
        if driver_id in self.active_connections:
            del self.active_connections[driver_id]
            logger.info(f"Driver {driver_id} disconnected")

    def disconnect_admin(self, websocket: WebSocket):
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)
            logger.info("Admin disconnected")

    async def broadcast_to_admins(self, message: dict):
        disconnected = []
        for connection in self.admin_connections:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)
        for conn in disconnected:
            self.admin_connections.remove(conn)

    async def send_to_driver(self, driver_id: str, message: dict):
        if driver_id in self.active_connections:
            try:
                await self.active_connections[driver_id].send_json(message)
            except:
                self.disconnect_driver(driver_id)

manager = ConnectionManager()

# ============== MODELS ==============

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password: str
    name: str
    role: str = "driver"  # driver, admin, supervisor
    phone: Optional[str] = None
    company: Optional[str] = None
    vehicle_type: Optional[str] = None  # truck, van, car
    license_plate: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "driver"
    phone: Optional[str] = None
    company: Optional[str] = None
    vehicle_type: Optional[str] = None
    license_plate: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class Route(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    waypoints: List[Dict[str, float]]  # [{lat, lng, name, order}]
    destination: Dict[str, Any]  # {lat, lng, name, type}
    vehicle_types: List[str] = ["truck", "van", "car"]
    speed_limits: List[Dict[str, Any]] = []  # [{start, end, limit}]
    danger_zones: List[Dict[str, Any]] = []  # [{lat, lng, radius, description}]
    restricted_zones: List[Dict[str, Any]] = []
    estimated_time: int = 10  # minutes
    distance: float = 0  # km
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class RouteCreate(BaseModel):
    name: str
    description: Optional[str] = None
    waypoints: List[Dict[str, float]]
    destination: Dict[str, Any]
    vehicle_types: List[str] = ["truck", "van", "car"]
    speed_limits: List[Dict[str, Any]] = []
    danger_zones: List[Dict[str, Any]] = []
    restricted_zones: List[Dict[str, Any]] = []
    estimated_time: int = 10
    distance: float = 0

class Delivery(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    qr_code: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    route_id: str
    route_name: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed, cancelled
    scheduled_time: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    company: Optional[str] = None
    notes: Optional[str] = None
    vehicle_type: Optional[str] = None
    license_plate: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DeliveryCreate(BaseModel):
    driver_id: Optional[str] = None
    route_id: str
    scheduled_time: Optional[datetime] = None
    company: Optional[str] = None
    notes: Optional[str] = None
    vehicle_type: Optional[str] = None
    license_plate: Optional[str] = None

class LocationUpdate(BaseModel):
    driver_id: str
    delivery_id: str
    latitude: float
    longitude: float
    speed: Optional[float] = 0
    heading: Optional[float] = 0
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ActiveDriver(BaseModel):
    driver_id: str
    driver_name: str
    delivery_id: str
    route_id: str
    route_name: str
    latitude: float
    longitude: float
    speed: float = 0
    heading: float = 0
    status: str = "en_route"  # en_route, arrived, deviation, stopped, emergency
    vehicle_type: str = "truck"
    license_plate: Optional[str] = None
    last_update: datetime = Field(default_factory=datetime.utcnow)
    deviation_count: int = 0
    alerts: List[Dict[str, Any]] = []

class Alert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    driver_name: str
    delivery_id: str
    type: str  # deviation, speed, emergency, stopped, zone_violation
    message: str
    latitude: float
    longitude: float
    severity: str = "medium"  # low, medium, high, critical
    is_resolved: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None

class Camera(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: Dict[str, float]  # {lat, lng}
    zone: str
    stream_url: Optional[str] = None
    is_active: bool = True

# ============== DEMO DATA ==============

# Industrial site center (Demo - near Paris)
SITE_CENTER = {"lat": 48.8566, "lng": 2.3522}

# Demo routes for the industrial site
DEMO_ROUTES = [
    {
        "id": "route-1",
        "name": "Quai A - Chargement Principal",
        "description": "Itinéraire vers le quai de chargement principal",
        "waypoints": [
            {"lat": 48.8566, "lng": 2.3522, "name": "Entrée Principale", "order": 1},
            {"lat": 48.8570, "lng": 2.3530, "name": "Route Principale", "order": 2},
            {"lat": 48.8575, "lng": 2.3540, "name": "Zone Parking", "order": 3},
        ],
        "destination": {"lat": 48.8580, "lng": 2.3550, "name": "Quai A", "type": "loading_dock"},
        "vehicle_types": ["truck", "van"],
        "speed_limits": [{"start": 0, "end": 1, "limit": 20}, {"start": 1, "end": 3, "limit": 30}],
        "danger_zones": [{"lat": 48.8572, "lng": 2.3535, "radius": 50, "description": "Zone piétonne"}],
        "restricted_zones": [],
        "estimated_time": 8,
        "distance": 1.2,
        "is_active": True
    },
    {
        "id": "route-2",
        "name": "Entrepôt B - Stockage",
        "description": "Itinéraire vers l'entrepôt de stockage B",
        "waypoints": [
            {"lat": 48.8566, "lng": 2.3522, "name": "Entrée Principale", "order": 1},
            {"lat": 48.8560, "lng": 2.3530, "name": "Voie Sud", "order": 2},
            {"lat": 48.8555, "lng": 2.3545, "name": "Carrefour Central", "order": 3},
        ],
        "destination": {"lat": 48.8550, "lng": 2.3560, "name": "Entrepôt B", "type": "warehouse"},
        "vehicle_types": ["truck", "van", "car"],
        "speed_limits": [{"start": 0, "end": 3, "limit": 25}],
        "danger_zones": [{"lat": 48.8558, "lng": 2.3538, "radius": 30, "description": "Zone de manœuvre"}],
        "restricted_zones": [],
        "estimated_time": 10,
        "distance": 1.5,
        "is_active": True
    },
    {
        "id": "route-3",
        "name": "Zone Technique C",
        "description": "Itinéraire vers la zone technique",
        "waypoints": [
            {"lat": 48.8566, "lng": 2.3522, "name": "Entrée Principale", "order": 1},
            {"lat": 48.8570, "lng": 2.3510, "name": "Voie Nord", "order": 2},
            {"lat": 48.8578, "lng": 2.3500, "name": "Accès Technique", "order": 3},
        ],
        "destination": {"lat": 48.8585, "lng": 2.3495, "name": "Zone Technique C", "type": "technical"},
        "vehicle_types": ["van", "car"],
        "speed_limits": [{"start": 0, "end": 3, "limit": 15}],
        "danger_zones": [],
        "restricted_zones": [{"lat": 48.8582, "lng": 2.3502, "radius": 20, "description": "Zone interdite camions"}],
        "estimated_time": 12,
        "distance": 1.8,
        "is_active": True
    }
]

# Demo cameras
DEMO_CAMERAS = [
    {"id": "cam-1", "name": "Caméra Entrée", "location": {"lat": 48.8566, "lng": 2.3522}, "zone": "Entrée", "is_active": True},
    {"id": "cam-2", "name": "Caméra Quai A", "location": {"lat": 48.8580, "lng": 2.3550}, "zone": "Quai A", "is_active": True},
    {"id": "cam-3", "name": "Caméra Entrepôt B", "location": {"lat": 48.8550, "lng": 2.3560}, "zone": "Entrepôt B", "is_active": True},
    {"id": "cam-4", "name": "Caméra Zone Technique", "location": {"lat": 48.8585, "lng": 2.3495}, "zone": "Zone Technique", "is_active": True},
    {"id": "cam-5", "name": "Caméra Parking", "location": {"lat": 48.8575, "lng": 2.3540}, "zone": "Parking", "is_active": True},
]

# In-memory active drivers store (for real-time tracking)
active_drivers: Dict[str, dict] = {}

# ============== HELPER FUNCTIONS ==============

def generate_qr_code(data: dict) -> str:
    """Generate QR code as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(json.dumps(data))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two points"""
    from math import radians, cos, sin, asin, sqrt
    R = 6371000  # Earth radius in meters
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    return 2 * R * asin(sqrt(a))

def check_deviation(current_lat: float, current_lng: float, route_waypoints: list, tolerance: float = 100) -> bool:
    """Check if driver is deviating from route (tolerance in meters)"""
    for waypoint in route_waypoints:
        dist = calculate_distance(current_lat, current_lng, waypoint['lat'], waypoint['lng'])
        if dist < tolerance:
            return False
    return True

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=dict)
async def register(user: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    
    user_obj = User(**user.dict())
    await db.users.insert_one(user_obj.dict())
    return {"success": True, "user": {"id": user_obj.id, "email": user_obj.email, "name": user_obj.name, "role": user_obj.role}}

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or user['password'] != credentials.password:
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    
    return {
        "success": True,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "name": user['name'],
            "role": user['role'],
            "phone": user.get('phone'),
            "company": user.get('company'),
            "vehicle_type": user.get('vehicle_type'),
            "license_plate": user.get('license_plate')
        }
    }

# ============== ROUTES MANAGEMENT ==============

@api_router.get("/routes")
async def get_routes():
    routes = await db.routes.find({"is_active": True}).to_list(100)
    if not routes:
        # Insert demo routes if none exist
        for route in DEMO_ROUTES:
            route['created_at'] = datetime.utcnow()
            await db.routes.insert_one(route)
        return DEMO_ROUTES
    return [serialize_doc(r) for r in routes]

@api_router.get("/routes/{route_id}")
async def get_route(route_id: str):
    route = await db.routes.find_one({"id": route_id})
    if not route:
        # Check demo routes
        for r in DEMO_ROUTES:
            if r['id'] == route_id:
                return r
        raise HTTPException(status_code=404, detail="Itinéraire non trouvé")
    return serialize_doc(route)

@api_router.post("/routes", response_model=dict)
async def create_route(route: RouteCreate):
    route_obj = Route(**route.dict())
    await db.routes.insert_one(route_obj.dict())
    return route_obj.dict()

@api_router.put("/routes/{route_id}")
async def update_route(route_id: str, route: RouteCreate):
    result = await db.routes.update_one({"id": route_id}, {"$set": route.dict()})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Itinéraire non trouvé")
    return {"success": True}

@api_router.delete("/routes/{route_id}")
async def delete_route(route_id: str):
    result = await db.routes.update_one({"id": route_id}, {"$set": {"is_active": False}})
    return {"success": True}

# ============== DELIVERY MANAGEMENT ==============

@api_router.get("/deliveries")
async def get_deliveries(status: Optional[str] = None):
    query = {}
    if status:
        query['status'] = status
    deliveries = await db.deliveries.find(query).sort("created_at", -1).to_list(100)
    return [serialize_doc(d) for d in deliveries]

@api_router.get("/deliveries/{delivery_id}")
async def get_delivery(delivery_id: str):
    delivery = await db.deliveries.find_one({"id": delivery_id})
    if not delivery:
        raise HTTPException(status_code=404, detail="Livraison non trouvée")
    return serialize_doc(delivery)

@api_router.post("/deliveries", response_model=dict)
async def create_delivery(delivery: DeliveryCreate):
    # Get route info
    route = await db.routes.find_one({"id": delivery.route_id})
    if not route:
        for r in DEMO_ROUTES:
            if r['id'] == delivery.route_id:
                route = r
                break
    
    delivery_obj = Delivery(**delivery.dict())
    if route:
        delivery_obj.route_name = route.get('name', '')
    
    # Generate QR code
    qr_data = {
        "delivery_id": delivery_obj.id,
        "route_id": delivery_obj.route_id,
        "scheduled_time": delivery_obj.scheduled_time.isoformat() if delivery_obj.scheduled_time else None
    }
    delivery_obj.qr_code = generate_qr_code(qr_data)
    
    await db.deliveries.insert_one(delivery_obj.dict())
    return delivery_obj.dict()

@api_router.put("/deliveries/{delivery_id}/status")
async def update_delivery_status(delivery_id: str, status: str):
    update_data = {"status": status}
    if status == "in_progress":
        update_data["start_time"] = datetime.utcnow()
    elif status == "completed":
        update_data["end_time"] = datetime.utcnow()
    
    result = await db.deliveries.update_one({"id": delivery_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Livraison non trouvée")
    return {"success": True}

@api_router.post("/deliveries/{delivery_id}/assign")
async def assign_delivery(delivery_id: str, driver_id: str):
    driver = await db.users.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Livreur non trouvé")
    
    update_data = {
        "driver_id": driver_id,
        "driver_name": driver.get('name', ''),
        "vehicle_type": driver.get('vehicle_type', ''),
        "license_plate": driver.get('license_plate', '')
    }
    
    result = await db.deliveries.update_one({"id": delivery_id}, {"$set": update_data})
    return {"success": True}

# ============== QR CODE ==============

@api_router.post("/qr/scan")
async def scan_qr_code(data: dict):
    """Process scanned QR code and return delivery/route info"""
    try:
        qr_data = data.get('qr_data', {})
        if isinstance(qr_data, str):
            qr_data = json.loads(qr_data)
        
        delivery_id = qr_data.get('delivery_id')
        route_id = qr_data.get('route_id')
        
        delivery = await db.deliveries.find_one({"id": delivery_id})
        if not delivery:
            raise HTTPException(status_code=404, detail="Livraison non trouvée")
        
        route = await db.routes.find_one({"id": route_id})
        if not route:
            for r in DEMO_ROUTES:
                if r['id'] == route_id:
                    route = r
                    break
        
        return {
            "success": True,
            "delivery": delivery,
            "route": route
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"QR code invalide: {str(e)}")

@api_router.get("/qr/generate/{delivery_id}")
async def generate_delivery_qr(delivery_id: str):
    """Generate QR code for a delivery"""
    delivery = await db.deliveries.find_one({"id": delivery_id})
    if not delivery:
        raise HTTPException(status_code=404, detail="Livraison non trouvée")
    
    qr_data = {
        "delivery_id": delivery_id,
        "route_id": delivery.get('route_id'),
        "scheduled_time": delivery.get('scheduled_time').isoformat() if delivery.get('scheduled_time') else None
    }
    qr_base64 = generate_qr_code(qr_data)
    return {"qr_code": qr_base64}

# ============== LOCATION TRACKING ==============

@api_router.post("/location/update")
async def update_location(location: LocationUpdate):
    """Update driver location"""
    # Store location history
    await db.location_history.insert_one(location.dict())
    
    # Get delivery and route info
    delivery = await db.deliveries.find_one({"id": location.delivery_id})
    route = None
    if delivery:
        route = await db.routes.find_one({"id": delivery.get('route_id')})
        if not route:
            for r in DEMO_ROUTES:
                if r['id'] == delivery.get('route_id'):
                    route = r
                    break
    
    # Check for deviations and alerts
    alerts = []
    status = "en_route"
    
    if route:
        # Check deviation
        is_deviating = check_deviation(location.latitude, location.longitude, route.get('waypoints', []))
        if is_deviating:
            status = "deviation"
            alert = Alert(
                driver_id=location.driver_id,
                driver_name=delivery.get('driver_name', 'Inconnu') if delivery else 'Inconnu',
                delivery_id=location.delivery_id,
                type="deviation",
                message="Déviation de l'itinéraire détectée",
                latitude=location.latitude,
                longitude=location.longitude,
                severity="medium"
            )
            await db.alerts.insert_one(alert.dict())
            alerts.append(alert.dict())
        
        # Check speed
        if location.speed and location.speed > 30:  # km/h
            alert = Alert(
                driver_id=location.driver_id,
                driver_name=delivery.get('driver_name', 'Inconnu') if delivery else 'Inconnu',
                delivery_id=location.delivery_id,
                type="speed",
                message=f"Vitesse excessive: {location.speed:.1f} km/h",
                latitude=location.latitude,
                longitude=location.longitude,
                severity="high"
            )
            await db.alerts.insert_one(alert.dict())
            alerts.append(alert.dict())
    
    # Update active drivers
    driver_data = {
        "driver_id": location.driver_id,
        "driver_name": delivery.get('driver_name', 'Livreur') if delivery else 'Livreur',
        "delivery_id": location.delivery_id,
        "route_id": delivery.get('route_id', '') if delivery else '',
        "route_name": delivery.get('route_name', '') if delivery else '',
        "latitude": location.latitude,
        "longitude": location.longitude,
        "speed": location.speed or 0,
        "heading": location.heading or 0,
        "status": status,
        "vehicle_type": delivery.get('vehicle_type', 'truck') if delivery else 'truck',
        "license_plate": delivery.get('license_plate', '') if delivery else '',
        "last_update": datetime.utcnow().isoformat(),
        "alerts": alerts
    }
    active_drivers[location.driver_id] = driver_data
    
    # Broadcast to admins
    await manager.broadcast_to_admins({
        "type": "location_update",
        "data": driver_data
    })
    
    return {"success": True, "alerts": alerts}

@api_router.get("/location/active")
async def get_active_drivers():
    """Get all active drivers with their current location"""
    return list(active_drivers.values())

@api_router.get("/location/history/{delivery_id}")
async def get_location_history(delivery_id: str):
    """Get location history for a delivery"""
    history = await db.location_history.find({"delivery_id": delivery_id}).sort("timestamp", 1).to_list(1000)
    return history

# ============== ALERTS ==============

@api_router.get("/alerts", response_model=List[dict])
async def get_alerts(resolved: Optional[bool] = None):
    query = {}
    if resolved is not None:
        query['is_resolved'] = resolved
    alerts = await db.alerts.find(query).sort("created_at", -1).to_list(100)
    return alerts

@api_router.post("/alerts/emergency")
async def create_emergency_alert(data: dict):
    """Create emergency alert from driver"""
    alert = Alert(
        driver_id=data.get('driver_id'),
        driver_name=data.get('driver_name', 'Inconnu'),
        delivery_id=data.get('delivery_id', ''),
        type="emergency",
        message=data.get('message', 'Urgence signalée par le livreur'),
        latitude=data.get('latitude', 0),
        longitude=data.get('longitude', 0),
        severity="critical"
    )
    await db.alerts.insert_one(alert.dict())
    
    # Broadcast to admins
    await manager.broadcast_to_admins({
        "type": "emergency",
        "data": alert.dict()
    })
    
    return {"success": True, "alert_id": alert.id}

@api_router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    result = await db.alerts.update_one(
        {"id": alert_id},
        {"$set": {"is_resolved": True, "resolved_at": datetime.utcnow()}}
    )
    return {"success": True}

# ============== CAMERAS (Simulated) ==============

@api_router.get("/cameras", response_model=List[dict])
async def get_cameras():
    cameras = await db.cameras.find({"is_active": True}).to_list(100)
    if not cameras:
        # Insert demo cameras
        for cam in DEMO_CAMERAS:
            await db.cameras.insert_one(cam)
        cameras = DEMO_CAMERAS
    return cameras

@api_router.get("/cameras/nearest")
async def get_nearest_camera(lat: float, lng: float):
    """Get the nearest camera to a location"""
    cameras = await get_cameras()
    nearest = None
    min_dist = float('inf')
    
    for cam in cameras:
        dist = calculate_distance(lat, lng, cam['location']['lat'], cam['location']['lng'])
        if dist < min_dist:
            min_dist = dist
            nearest = cam
    
    return {"camera": nearest, "distance": min_dist}

# ============== SITE MAP DATA ==============

@api_router.get("/site/info")
async def get_site_info():
    """Get industrial site information"""
    return {
        "name": "Site Industriel Demo",
        "center": SITE_CENTER,
        "bounds": {
            "north": SITE_CENTER['lat'] + 0.005,
            "south": SITE_CENTER['lat'] - 0.005,
            "east": SITE_CENTER['lng'] + 0.008,
            "west": SITE_CENTER['lng'] - 0.008
        },
        "buildings": [
            {"id": "b1", "name": "Bâtiment Principal", "type": "office", "lat": 48.8568, "lng": 2.3525},
            {"id": "b2", "name": "Entrepôt A", "type": "warehouse", "lat": 48.8575, "lng": 2.3545},
            {"id": "b3", "name": "Entrepôt B", "type": "warehouse", "lat": 48.8550, "lng": 2.3560},
            {"id": "b4", "name": "Zone Technique", "type": "technical", "lat": 48.8585, "lng": 2.3495},
            {"id": "b5", "name": "Quai A", "type": "loading_dock", "lat": 48.8580, "lng": 2.3550},
        ],
        "entrances": [
            {"id": "e1", "name": "Entrée Principale", "lat": 48.8566, "lng": 2.3522, "type": "main"},
            {"id": "e2", "name": "Entrée Nord", "lat": 48.8580, "lng": 2.3510, "type": "secondary"},
        ],
        "parking": [
            {"id": "p1", "name": "Parking Poids Lourds", "lat": 48.8575, "lng": 2.3540, "capacity": 20},
            {"id": "p2", "name": "Parking VL", "lat": 48.8562, "lng": 2.3535, "capacity": 50},
        ]
    }

# ============== STATISTICS ==============

@api_router.get("/stats/dashboard")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_deliveries = await db.deliveries.count_documents({})
    today_deliveries = await db.deliveries.count_documents({"created_at": {"$gte": today}})
    pending_deliveries = await db.deliveries.count_documents({"status": "pending"})
    in_progress = await db.deliveries.count_documents({"status": "in_progress"})
    completed_today = await db.deliveries.count_documents({"status": "completed", "end_time": {"$gte": today}})
    
    active_alerts = await db.alerts.count_documents({"is_resolved": False})
    critical_alerts = await db.alerts.count_documents({"is_resolved": False, "severity": "critical"})
    
    return {
        "total_deliveries": total_deliveries,
        "today_deliveries": today_deliveries,
        "pending_deliveries": pending_deliveries,
        "in_progress": in_progress,
        "completed_today": completed_today,
        "active_drivers": len(active_drivers),
        "active_alerts": active_alerts,
        "critical_alerts": critical_alerts
    }

# ============== WEBSOCKET ==============

@app.websocket("/ws/driver/{driver_id}")
async def websocket_driver(websocket: WebSocket, driver_id: str):
    await manager.connect_driver(websocket, driver_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Handle driver messages (location updates, etc.)
            if data.get('type') == 'location':
                location = LocationUpdate(
                    driver_id=driver_id,
                    delivery_id=data.get('delivery_id', ''),
                    latitude=data.get('latitude', 0),
                    longitude=data.get('longitude', 0),
                    speed=data.get('speed', 0),
                    heading=data.get('heading', 0)
                )
                await update_location(location)
    except WebSocketDisconnect:
        manager.disconnect_driver(driver_id)
        # Remove from active drivers
        if driver_id in active_drivers:
            del active_drivers[driver_id]
        await manager.broadcast_to_admins({
            "type": "driver_disconnected",
            "driver_id": driver_id
        })

@app.websocket("/ws/admin")
async def websocket_admin(websocket: WebSocket):
    await manager.connect_admin(websocket)
    try:
        # Send current active drivers
        await websocket.send_json({
            "type": "active_drivers",
            "data": list(active_drivers.values())
        })
        while True:
            data = await websocket.receive_json()
            # Handle admin commands
            if data.get('type') == 'message_driver':
                driver_id = data.get('driver_id')
                await manager.send_to_driver(driver_id, {
                    "type": "admin_message",
                    "message": data.get('message')
                })
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)

# ============== ROOT ==============

@api_router.get("/")
async def root():
    return {"message": "SiteTrack API - Suivi de Livreurs sur Site Industriel", "status": "running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Initialize demo data
    routes_count = await db.routes.count_documents({})
    if routes_count == 0:
        for route in DEMO_ROUTES:
            route['created_at'] = datetime.utcnow()
            await db.routes.insert_one(route)
        logger.info("Demo routes initialized")
    
    cameras_count = await db.cameras.count_documents({})
    if cameras_count == 0:
        for cam in DEMO_CAMERAS:
            await db.cameras.insert_one(cam)
        logger.info("Demo cameras initialized")
    
    # Create admin user if not exists
    admin = await db.users.find_one({"email": "admin@sitetrack.fr"})
    if not admin:
        admin_user = User(
            email="admin@sitetrack.fr",
            password="admin123",
            name="Administrateur",
            role="admin"
        )
        await db.users.insert_one(admin_user.dict())
        logger.info("Admin user created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
