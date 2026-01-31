const guestSearchCooldown = new Map();

export const throttleGuestSearch = (req, res, next) => {
  const key = req.user.id;
  const now = Date.now();

  if (guestSearchCooldown.has(key)) {
    const last = guestSearchCooldown.get(key);
    if (now - last < 300) {
      return res.status(429).json({
        success: false,
        message: "Too many search requests",
      });
    }
  }

  guestSearchCooldown.set(key, now);
  next();
};
