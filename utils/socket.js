import { Server } from "socket.io";
let io;

export const initSockets = (server) => {
  io = new Server(server, { cors: { origin: "*" } });
  io.on("connection", socket => {
    console.log("Socket connected", socket.id);
    socket.on("join_hotel_room", ({ hotelId, role }) => {
      socket.join(`hotel_${hotelId}`);
      if(role) socket.join(`${role}_${hotelId}`);
    });
    socket.on("disconnect", () => console.log("Socket disconnected", socket.id));
  });
};

export const emitToHotel = (hotelId, event, payload) => {
  if (!io) return;
  io.to(`hotel_${hotelId}`).emit(event, payload);
};

export const emitToRole = (hotelId, role, event, payload) => {
  if (!io) return;
  io.to(`${role}_${hotelId}`).emit(event, payload);
};
