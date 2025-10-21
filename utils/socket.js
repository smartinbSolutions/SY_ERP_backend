let io;

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    socket.on("joinSalePoint", (salePointId) => {
      socket.join(salePointId);
      console.log(
        `👤 Socket ${socket.id} joined SalePoint room: ${salePointId}`
      );
    });

    socket.on("joinRoleRoom", (role) => {
      const roomName = `room:${role}`;
      socket.join(roomName);
      console.log(`👤 Socket ${socket.id} joined Role Room: ${roomName}`);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIo() {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
}

module.exports = { initSocket, getIo };
