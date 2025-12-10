import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Bed, Users, Hotel } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAllRoomsApi, getAvailableRoomsByDateApi } from "@/api/roomApi";

const statusConfig: any = {
  AVAILABLE: { label: "Available", className: "bg-room-available text-white" },
  OCCUPIED: { label: "Occupied", className: "bg-room-occupied text-white" },
  CLEANING: { label: "Cleaning", className: "bg-room-cleaning text-white" },
  MAINTENANCE: { label: "Maintenance", className: "bg-room-maintenance text-white" },
};

export default function RoomList() {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // DATE FILTER STATES
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  // -----------------------------
  // LOAD ALL ROOMS INITIALLY
  // -----------------------------
  useEffect(() => {
    loadAllRooms();
  }, []);

  const loadAllRooms = async () => {
    try {
      setLoading(true);
      const resp = await getAllRoomsApi();
      setRooms(resp.rooms || resp);
    } catch (e) {
      toast.error("Failed to load rooms");
    }
    setLoading(false);
  };

  // -----------------------------
  // FILTER ROOMS (search + status toggle)
  // -----------------------------
  const filteredRooms = rooms.filter((room) => {
    const statusMatch = filterStatus === "all" || room.status === filterStatus;

    const searchMatch =
      room.number?.toString().includes(searchTerm) ||
      room.type?.toLowerCase().includes(searchTerm.toLowerCase());

    return statusMatch && searchMatch;
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Hotel className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Room Bookings</h1>
              <p className="text-muted-foreground">View and manage room bookings</p>
            </div>
          </div>

          <Button onClick={() => navigate("/rooms/bookings/create")}>
            <Plus className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </div>

        {/* FILTERS */}
        <Card>
          <CardContent className="pt-6 space-y-4">

            {/* SEARCH + STATUS FILTERS */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search room number or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant={filterStatus === "all" ? "default" : "outline"}
                  onClick={() => setFilterStatus("all")}
                >
                  All
                </Button>

                <Button
                  variant={filterStatus === "AVAILABLE" ? "default" : "outline"}
                  onClick={() => setFilterStatus("AVAILABLE")}
                >
                  Available
                </Button>

                <Button
                  variant={filterStatus === "OCCUPIED" ? "default" : "outline"}
                  onClick={() => setFilterStatus("OCCUPIED")}
                >
                  Occupied
                </Button>
              </div>
            </div>

            {/* DATE FILTERS */}
            <div className="flex flex-col gap-4 sm:flex-row">

              <div className="flex flex-col flex-1">
                <label className="text-sm mb-1 text-muted-foreground">Check-In</label>
                <Input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>

              <div className="flex flex-col flex-1">
                <label className="text-sm mb-1 text-muted-foreground">Check-Out</label>
                <Input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>

              {/* SEARCH AVAILABLE ROOMS */}
              <Button
                className="self-end"
                onClick={async () => {
                  if (!checkIn || !checkOut) {
                    toast.error("Please select both Check-in & Check-out dates");
                    return;
                  }

                  try {
                    setLoading(true);
                    const resp = await getAvailableRoomsByDateApi(checkIn, checkOut);
                    setRooms(resp.rooms || []);
                    toast.success("Showing rooms available for selected dates");
                  } catch (e) {
                    toast.error("Failed to fetch available rooms");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Search Availability
              </Button>

              {/* RESET DATE FILTER */}
              <Button
                variant="outline"
                className="self-end"
                onClick={() => {
                  setCheckIn("");
                  setCheckOut("");
                  loadAllRooms();
                }}
              >
                Reset
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* ROOMS GRID */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? (
            <p>Loading rooms...</p>
          ) : filteredRooms.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No rooms found</p>
          ) : (
            filteredRooms.map((room) => {
              const status = room.status || "AVAILABLE";
              const config = statusConfig[status] || statusConfig.AVAILABLE;

              return (
                <Card
                  key={room._id}
                  className="cursor-pointer hover:shadow-lg transition"
                  onClick={() => navigate(`/rooms/bookings/${room._id}`)}
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-2xl font-bold">Room {room.number}</h3>
                          <p className="text-sm text-muted-foreground">Floor {room.floor || "-"}</p>
                        </div>
                        <Badge className={config.className}>{config.label}</Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Bed className="h-4 w-4 text-muted-foreground" />
                          <span>{room.type}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{room.maxGuests || 1} Guests</span>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Base Rate</span>
                          <span className="text-lg font-bold text-primary">₹{room.baseRate || 0}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
