"use client"

export default function GianLuccaRanch() {
  const animals = [
    { emoji: "🐻", name: "Bear", text: "Your best friend!" },
    { emoji: "🐔", name: "Chickens", text: "Cluck cluck!" },
    { emoji: "🦃", name: "Turkeys", text: "Gobble gobble!" },
    { emoji: "🏠", name: "The Ranch", text: "Home sweet home" },
  ]

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "32px 16px",
        fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive, sans-serif",
        background: "linear-gradient(180deg, #87CEEB 0%, #B0E0E6 40%, #90EE90 70%, #228B22 100%)",
        color: "#3E2723",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      {/* Floating sun and clouds */}
      <div style={{ position: "relative", width: "100%", maxWidth: "800px", height: "80px", marginBottom: "8px" }}>
        <span style={{ position: "absolute", top: 0, left: "10%", fontSize: "64px" }}>☀️</span>
        <span style={{ position: "absolute", top: "10px", left: "55%", fontSize: "48px" }}>☁️</span>
        <span style={{ position: "absolute", top: "20px", left: "75%", fontSize: "36px" }}>☁️</span>
      </div>

      {/* Hero */}
      <section
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.92)",
          borderRadius: "32px",
          padding: "32px 24px",
          marginBottom: "32px",
          width: "100%",
          maxWidth: "800px",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.15)",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(36px, 8vw, 64px)",
            margin: "0 0 16px 0",
            color: "#2E7D32",
            textShadow: "2px 2px 0px #FFF",
            lineHeight: 1.2,
          }}
        >
          🐻🐔 Gian Lucca's Ranch 🦃🏠
        </h1>
        <p
          style={{
            fontSize: "clamp(20px, 4vw, 30px)",
            margin: 0,
            color: "#795548",
            fontWeight: "bold",
          }}
        >
          From Daddy with Love ❤️
        </p>

        <div
          style={{
            marginTop: "24px",
            borderRadius: "24px",
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2)",
            backgroundColor: "#000",
          }}
        >
          <video
            src="/videos/pw_bababa.mp4"
            muted
            loop
            playsInline
            controls
            style={{
              width: "100%",
              height: "auto",
              display: "block",
            }}
          />
        </div>
      </section>

      {/* Animal cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "24px",
          width: "100%",
          maxWidth: "900px",
          marginBottom: "32px",
        }}
      >
        {animals.map((animal) => (
          <button
            key={animal.name}
            onClick={() => {
              if (typeof window !== "undefined") {
                const msg = new SpeechSynthesisUtterance(`${animal.name}! ${animal.text}`)
                msg.rate = 0.8
                msg.pitch = 1.2
                window.speechSynthesis.speak(msg)
              }
            }}
            style={{
              backgroundColor: "#FFFFFF",
              border: "none",
              borderRadius: "28px",
              padding: "32px 20px",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              minHeight: "180px",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.08)"
              e.currentTarget.style.boxShadow = "0 14px 36px rgba(0, 0, 0, 0.18)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)"
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)"
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = "scale(1.08)"
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = "scale(1)"
            }}
          >
            <span style={{ fontSize: "72px", lineHeight: 1 }}>{animal.emoji}</span>
            <span style={{ fontSize: "28px", fontWeight: "bold", color: "#5D4037" }}>{animal.name}</span>
            <span style={{ fontSize: "20px", color: "#795548" }}>{animal.text}</span>
          </button>
        ))}
      </section>

      {/* Story Time section */}
      <section
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.92)",
          borderRadius: "32px",
          padding: "32px 24px",
          marginBottom: "32px",
          width: "100%",
          maxWidth: "800px",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.15)",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(28px, 5vw, 40px)",
            margin: "0 0 16px 0",
            color: "#5D4037",
          }}
        >
          📖 Story Time
        </h2>
        <p style={{ fontSize: "22px", margin: "0 0 24px 0", color: "#795548" }}>
          The Sleepy Little Bear
        </p>
        <div
          style={{
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
            backgroundColor: "#000",
          }}
        >
          <video
            src="/videos/sleepy_little_bear.mp4"
            muted
            loop
            playsInline
            controls
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      </section>

      {/* Music section */}
      <section
        style={{
          backgroundColor: "rgba(255, 248, 220, 0.95)",
          borderRadius: "32px",
          padding: "32px 24px",
          marginBottom: "32px",
          width: "100%",
          maxWidth: "800px",
          boxShadow: "0 10px 28px rgba(0, 0, 0, 0.12)",
          border: "4px solid #FFB74D",
        }}
      >
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🎵🎶</div>
        <h2 style={{ fontSize: "clamp(26px, 5vw, 38px)", margin: "0 0 16px 0", color: "#E65100" }}>
          Ba Ba Ab
        </h2>
        <p style={{ fontSize: "22px", margin: "0 0 24px 0", color: "#5D4037" }}>
          Daddy's favorite lullaby
        </p>
        <audio
          src="/audio/bababa.m4a"
          controls
          style={{ width: "100%", maxWidth: "400px" }}
        />
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: "auto",
          padding: "24px",
          fontSize: "18px",
          color: "#FFFFFF",
          fontWeight: "bold",
          textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        Made with love for Gian Lucca — Bear, chickens, turkeys and all 🐻🐔🦃❤️
      </footer>
    </main>
  )
}
