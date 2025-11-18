function createSparkles() {
  const container = document.getElementById("sparkles");
  for (let i = 0; i < 25; i++) {
    let s = document.createElement("div");
    s.className = "spark";
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.animationDuration = 2 + Math.random() * 3 + "s";
    container.appendChild(s);
  }
}
createSparkles();
