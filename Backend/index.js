const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
  },
});

let drawingHistory = [];
let redoStack = []; 
let connectedUsers = {}; 
let currentWriter = null; 

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  const clientName = `Client${Object.keys(connectedUsers).length + 1}`;
  connectedUsers[socket.id] = clientName;

  socket.emit("initializeCanvas", { drawingHistory, connectedUsers });

  io.emit("updateUsers", connectedUsers);

  socket.on("startDrawing", () => {
    currentWriter = connectedUsers[socket.id];
    io.emit("whoIsWriting", currentWriter);
  });

  socket.on("stopDrawing", () => {
    currentWriter = null;
    io.emit("whoIsWriting", null);
  });

  socket.on("draw", (data) => {
    drawingHistory.push(data);
    redoStack = []; 
    io.emit("draw", data); 
  });

  socket.on("undo", () => {
    if (drawingHistory.length > 0) {
      const lastStroke = drawingHistory.pop();
      redoStack.push(lastStroke);
      io.emit("undo", drawingHistory);
    }
  });

  socket.on("redo", () => {
    if (redoStack.length > 0) {
      const restoredStroke = redoStack.pop();
      drawingHistory.push(restoredStroke);
      io.emit("draw", restoredStroke);
    }
  });

  socket.on("clearAll", () => {
    drawingHistory = [];
    redoStack = [];
    io.emit("clearCanvas");
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    delete connectedUsers[socket.id];
    io.emit("updateUsers", connectedUsers);

    if (currentWriter === connectedUsers[socket.id]) {
      currentWriter = null;
      io.emit("whoIsWriting", null);
    }
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
