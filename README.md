# reality-check-ai

RealityCheck AI is a Chrome browser extension that detects AI-generated images 
in real time as you browse — no action required from the user. It silently 
captures your active browser tab every two seconds, sends it to a FastAPI backend 
hosted on AWS EC2, and runs it through a fine-tuned image detection model trained 
to identify synthetic and AI-generated content. The result is displayed instantly 
as a floating overlay badge directly on the page, showing the probability that 
what you are looking at was AI-generated — alongside a live dashboard that logs 
every scan in your session. No uploads, no manual steps, no prior suspicion needed. 
Just passive, automatic protection where the threat already lives.

---

## Try It

**Option A — No install required**  
Visit [http://EC2_IP:3000](#) to view a live scan session running in real time.

**Option B — Install in 90 seconds**  
1. Download and unzip `RealityCheckAI.zip`  
2. Open Chrome and go to `chrome://extensions`  
3. Toggle on **Developer Mode** (top right)  
4. Click **Load unpacked** and select the `extension/` folder  
5. Navigate to any webpage — the badge will appear automatically  

*(Screenshots coming soon)*

**Option C — Watch the Demo**  
[2-Minute Demo Video](#)

---

## Repository  
[GitHub — RealityCheck AI](#)

---

## Team — Git Up  
- Nozeelia Blair  
- Reneece Bartley  
- Jahzara Rose  
- Abishua Johnson
