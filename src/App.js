import React, { useRef, useState } from "react";

// Include Ruffle player - you must include ruffle.js in your HTML for this to work
// <script src="https://unpkg.com/@ruffle-rs/ruffle"></script>

const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 390;
const FRAME_MS = 100; // 10 fps

function getEmptyFrame() {
  return null; // Means blank/canvas clear
}

function cloneImageData(ctx, w, h) {
  return ctx.getImageData(0, 0, w, h);
}

export default function App() {
  const canvasRef = useRef();
  const [tool, setTool] = useState("brush");
  const [color, setColor] = useState("#222222");
  const [frames, setFrames] = useState([null]); // Array of ImageData
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Canvas drawing
  const [drawing, setDrawing] = useState(false);
  const [lastPt, setLastPt] = useState([0, 0]);
  const [dirty, setDirty] = useState(false);

  // Load current frame into canvas
  React.useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (frames[currentFrame]) {
      ctx.putImageData(frames[currentFrame], 0, 0);
    }
  }, [currentFrame, frames]);

  // Save frame on new drawing
  React.useEffect(() => {
    if (!dirty) return;
    const ctx = canvasRef.current.getContext("2d");
    const img = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setFrames(frames =>
      frames.map((f, i) => (i === currentFrame ? img : f))
    );
    setDirty(false);
    // eslint-disable-next-line
  }, [dirty]);

  // Timeline playback
  React.useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, frames.length]);

  // Mouse Draw handlers
  function handlePointerDown(e) {
    if (tool !== "brush") return;
    setDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left));
    const y = Math.floor((e.clientY - rect.top));
    setLastPt([x, y]);
  }
  function handlePointerMove(e) {
    if (!drawing || tool !== "brush") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left));
    const y = Math.floor((e.clientY - rect.top));
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(...lastPt);
    ctx.lineTo(x, y);
    ctx.stroke();
    setLastPt([x, y]);
    setDirty(true);
  }
  function handlePointerUp() {
    setDrawing(false);
  }

  function addFrame() {
    setFrames(f => [
      ...f.slice(0, currentFrame + 1),
      getEmptyFrame(),
      ...f.slice(currentFrame + 1),
    ]);
    setCurrentFrame(c => c + 1);
  }
  function deleteFrame() {
    if (frames.length < 2) return;
    setFrames(f => {
      const nf = [...f];
      nf.splice(currentFrame, 1);
      return nf;
    });
    setCurrentFrame(f => (f > 0 ? f - 1 : 0));
  }
  function copyFrame() {
    const ctx = canvasRef.current.getContext("2d");
    let cur = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setFrames(f =>
      f.map((x, i) => (i === currentFrame ? cur : x))
    );
    setDirty(false);
  }

  function handleExport() {
    // Export to zip of PNGs as MVP
    import("jszip").then(JSZip => {
      const zip = new JSZip.default();
      frames.forEach((img, i) => {
        if (img) {
          const offscreen = document.createElement("canvas");
          offscreen.width = CANVAS_WIDTH;
          offscreen.height = CANVAS_HEIGHT;
          offscreen.getContext("2d").putImageData(img, 0, 0);
          zip.file(
            `frame${i + 1}.png`,
            offscreen.toDataURL("image/png").split(",")[1],
            { base64: true }
          );
        }
      });
      zip.generateAsync({ type: "blob" }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "animation.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    });
  }

  return (
    <div style={{fontFamily: 'sans-serif', maxWidth: 800, margin: 'auto'}}>
      <h1>Flash-Style Animation Tool (MVP)</h1>
      <div style={{display:'flex',gap:32}}>
        <div>
          <canvas
            ref={canvasRef}
            style={{
              border: "1px solid #444",
              background: "#fff",
              cursor: tool === "brush" ? "crosshair" : "pointer"
            }}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          <div style={{marginTop:8}}>
            <button onClick={()=>setTool("brush")} disabled={tool==="brush"}>Brush</button>
            {/* Future: rect/ellipse/text tools */}
            <input type="color" value={color} onChange={e => setColor(e.target.value)}/>
            <button onClick={copyFrame}>Save Frame</button>
          </div>
          <div style={{marginTop:8}}>
            <button onClick={addFrame}>Add Frame</button>
            <button onClick={deleteFrame} disabled={frames.length<2}>Delete Frame</button>
          </div>
        </div>
        <div style={{flex:1}}>
          <b>Timeline</b>
          <div style={{display:'flex',alignItems:'center', margin:"8px 0",gap:2}}>
            {frames.map((img,i) =>
              <div
                key={i}
                style={{
                  width:32, height:24, margin:2,
                  border: i===currentFrame ? '2px solid #24f' : '1px solid #ccc',
                  background:img?"#eee":"#fafaff",
                  cursor:'pointer',
                  overflow:'hidden',
                  position:'relative'
                }}
                onClick={()=>setCurrentFrame(i)}
                title={`Frame ${i+1}`}>
                {/* Thumbnail */}
                <canvas
                  width={32}
                  height={24}
                  style={{position:'absolute',top:0,left:0}}
                  ref={ref => {
                    if(ref && img) {
                      const c2d = ref.getContext('2d');
                      const t = document.createElement('canvas');
                      t.width = CANVAS_WIDTH; t.height = CANVAS_HEIGHT;
                      t.getContext('2d').putImageData(img,0,0);
                      c2d?.drawImage(t,0,0,32,24);
                    }
                  }}
                />
              </div>
            )}
          </div>
          <div>
            <button onClick={()=>setPlaying(p=>!p)}>{playing ? "Pause" : "Play"}</button>
            <span style={{marginLeft:12}}>Frame: {currentFrame+1} / {frames.length}</span>
          </div>
          <div style={{marginTop:16}}>
            <button onClick={handleExport}>Export Animation (images)</button>
            {/* SWF export: advanced, phase 2 */}
          </div>
          <div style={{marginTop:24}}>
            <h4>Preview with Ruffle (SWF Player)</h4>
            {/* Instruct user to drag/drop their own SWF for now */}
            <div id="ruffle-demo" />
            <p>
              <em>
                For SWF preview, use <a href="https://ruffle.rs/demo/" target="_blank">Ruffle Demo</a> or drag/drop many SWF files here!
              </em>
            </p>
            {/* Future: Show exported SWFs here with ruffle-player component */}
          </div>
        </div>
      </div>
      <p>
        <small>
          Made for you with ❤ <br/>
          <b>Known limitations:</b> No SWF export yet, only PNG, simple brush tool. Extend with vector paths, shape tweening, layers as next steps!
        </small>
      </p>
    </div>
  );
}