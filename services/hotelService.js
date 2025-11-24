import Hotel from "../models/Hotel.js";

export const createHotel = async (payload) => {
  const hotel = await Hotel.create(payload);
  return hotel;
};

export const listHotels = async () => {
  return Hotel.find().sort({ createdAt: -1 });
};

export const getHotel = async (id) => {
  return Hotel.findById(id);
};

export const updateHotel = async (id, payload) => {
  return Hotel.findByIdAndUpdate(id, payload, { new: true });
};

export const deleteHotel = async (id) => {
  return Hotel.findByIdAndDelete(id);
};
