import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./Style.css";

const socket = io("http://localhost:4000");

function App() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState({});
  const [currentWriter, setCurrentWriter] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "black";
    ctxRef.current = ctx;

    socket.on("initializeCanvas", ({ drawingHistory, connectedUsers }) => {
      setConnectedUsers(connectedUsers);
      ctx.clearRect(0, 0, canvas.width, canvas.height); 
      drawingHistory.forEach((stroke) => drawStroke(stroke, ctx)); 
    });

    socket.on("updateUsers", (users) => setConnectedUsers(users));

    socket.on("whoIsWriting", (writer) => setCurrentWriter(writer));

    socket.on("draw", (data) => drawStroke(data, ctx));

    socket.on("undo", (updatedHistory) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      updatedHistory.forEach((stroke) => drawStroke(stroke, ctx));
    });

    socket.on("clearCanvas", () => ctx.clearRect(0, 0, canvas.width, canvas.height));

    return () => {
      socket.off("initializeCanvas");
      socket.off("updateUsers");
      socket.off("whoIsWriting");
      socket.off("draw");
      socket.off("undo");
      socket.off("clearCanvas");
    };
  }, []);

  const drawStroke = (data, ctx) => {
    ctx.beginPath();
    ctx.moveTo(data.startX, data.startY);
    ctx.lineTo(data.endX, data.endY);
    ctx.stroke();
    ctx.closePath();
  };

  const handleMouseDown = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setIsDrawing(true);
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lastX = offsetX;
    ctx.lastY = offsetY;
    socket.emit("startDrawing", { offsetX, offsetY });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const ctx = ctxRef.current;

    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();

    socket.emit("draw", {
      startX: ctx.lastX,
      startY: ctx.lastY,
      endX: offsetX,
      endY: offsetY,
    });

    ctx.lastX = offsetX;
    ctx.lastY = offsetY;
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const ctx = ctxRef.current;
    ctx.closePath();
    socket.emit("stopDrawing");
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "canvas.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="app">
      <div className="title">Real-Time Collaborative Whiteboard App</div>
      <div className="main">
        <div className="sidebar">
          <h2>Connected Users</h2>
          <ul>
            {Object.entries(connectedUsers).map(([id, name]) => (
              <li key={id}>{name}</li>
            ))}
          </ul>
          {currentWriter && <p>Currently Writing: {currentWriter}</p>}
        </div>
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
          <div className="controls">
            <button onClick={() => socket.emit("undo")}>Undo</button>
            <button onClick={() => socket.emit("redo")}>Redo</button>
            <button onClick={() => socket.emit("clearAll")}>Clear All</button>
            <button onClick={handleDownload}>Download</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
