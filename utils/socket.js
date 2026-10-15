const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "DELETE"],
    },
  });

  io.engine.on("connection_error", () => {});

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      const User = mongoose.model("user");

      const userId = decoded.id || decoded._id || decoded.userId;

      if (!userId) {
        return next(new Error("Invalid token payload"));
      }

      const user = await User.findById(userId).select("_id companyId");

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;

      next();
    } catch (error) {
      next(new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user?._id?.toString();

    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on("joinSalePoint", (salePointId) => {
      if (!salePointId) return;

      socket.join(salePointId);
    });

    socket.on("leaveSalePoint", (salePointId) => {
      if (!salePointId) return;

      socket.leave(salePointId);
    });

    socket.on("joinRoleRoom", (role) => {
      if (!role) return;

      socket.join(`room:${role}`);
    });

    socket.on("joinPayroll", (periodId) => {
      if (!periodId) return;

      socket.join(`payroll:${periodId}`);
    });

    socket.on("leavePayroll", (periodId) => {
      if (!periodId) return;

      socket.leave(`payroll:${periodId}`);
    });

    socket.on("disconnect", () => {});
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }

  return io;
}

module.exports = {
  initSocket,
  getIo,
};
