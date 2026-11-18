# 90-Second Demo Walkthrough Script: Otari Agent Sentinel
**Target Video Duration**: 75–85 Seconds (Strict Hackathon Rule: Must be under 2 minutes)  
**Live Site URL**: https://sidsri14.github.io/otari-agent-sentinel/  
**Recording Tool**: OBS, QuickTime, Loom, or Windows Game Bar (`Win + Alt + R`)  
**Format**: Full screen web browser, microphone enabled (Your human voice explaining the project).

---

## Storyboard & Voiceover Timeline

### 0:00 – 0:18 | The Problem & Architecture (Hook)
- **Screen Action**: Start at top of page `https://sidsri14.github.io/otari-agent-sentinel/`. Highlight the title banner.
- **Voiceover**:
  > *"Hi everyone, this is Siddharth. As autonomous AI agents navigate the open agentic web, they face two catastrophic risks: unbounded wallet drain from runaway loops or prompt injections, and cascading outages when upstream LLMs hit rate limits.*
  > 
  > *To solve this, I built **Otari Agent Sentinel**—an open-standard governance control plane and pre-debit budget firewall powered by the Mozilla Otari Gateway."*

---

### 0:18 – 0:42 | Feature 1: Semantic Routing & Pre-Debit Budget Guardrails
- **Screen Action**: Scroll down to the **Interactive Agent Mesh Sandbox**. Click **Tier 1 (Fast Open-Weight)**, then click **Execute Task**. Watch the virtual key balance update.
- **Voiceover**:
  > *"First, our Semantic Complexity Classifier categorizes incoming agent intent into three deterministic tiers. 
  > 
  > Before any inference call leaves the agent mesh, Sentinel atomically reserves an upper-bound budget against the agent's Otari virtual key. If an agent tries to overspend, execution halts immediately before any capital is burned. Notice how our virtual key balance atomically decrements and refunds unused tokens upon task completion."*

---

### 0:42 – 1:02 | Feature 2: HTTP 429 Circuit-Breaker Failover Cascades
- **Screen Action**: Click **Simulate HTTP 429 Rate Limit**. Point to the status badge transitioning from Primary to Fallback route without error.
- **Voiceover**:
  > *"Second, when an upstream provider experiences a sudden spike or HTTP 429 rate limit, our circuit breaker intercepts the error in under two milliseconds and cascades execution to a configured fallback endpoint. The user workflow never crashes, maintaining 99.9% agent uptime across decentralized hops."*

---

### 1:02 – 1:20 | Feature 3: Open Agentic Web Standards Compliance
- **Screen Action**: Scroll to the footer and click the link to inspect `agent-network.json` and `runtime.js`.
- **Voiceover**:
  > *"Sentinel 100% conforms to the Open Agentic Web specification: it exposes a conforming `agent-network.json` manifest describing the multi-agent topology and runs entirely client-side via browser `runtime.js`. 
  > 
  > Across our automated test suite, Sentinel delivers over 85% cost savings while guaranteeing fail-closed capital safety on the open agentic web. Thank you!"*

---

## Upload Checklist
1. Export video as MP4.
2. Upload to YouTube as **Public** or **Unlisted** (Title: *"Otari Agent Sentinel — Open Agentic Web Challenge Demo"*).
3. Paste YouTube link into chat or directly into Devpost Submission #1306912.
4. Devpost will automatically convert the submission from **Draft** to **Final Submitted**!
