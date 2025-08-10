# Jeopardy Game

A multiplayer Jeopardy web application that a6. Wait for contestants to join using the Session ID
7. Assign names to contestants as they connect
8. (Optional) Click "🤖 Generate New Questions" to create fresh questions using AI
9. Click on dollar amounts to select questions
10. Judge answers as correct or incorrect
11. Manage Daily Doubles and Final Jeopardy you to host games on your local machine with remote contestants.

## Features

- **Real-time Multiplayer**: Host and contestants connect through web browsers
- **Session-based Security**: 
  - Host password protection
  - Unique session IDs for each game
  - Session isolation (multiple games can run simultaneously)
- **Authentic Jeopardy Experience**: 
  - Traditional 6x5 category grid
  - Buzzer system (first to buzz gets to answer)
  - Daily Double questions with custom wagers
  - Final Jeopardy round
- **Host Controls**: 
  - Create and manage game sessions
  - Generate new questions using AI (OpenAI ChatGPT)
  - Assign names to contestants
  - View contestant IP addresses
  - Judge answers as correct/incorrect
  - Automatic score tracking
- **Contestant Features**:
  - Join games using session ID
  - Set custom display name when joining
  - Visual game board
  - Buzz-in button (also works with spacebar)
  - Wager input for Daily Doubles and Final Jeopardy
  - Real-time score updates

## Setup and Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables** (optional):
   - Copy `.env.example` to `.env` and configure if needed
   - Set `OPENAI_API_KEY` to enable AI question generation
   - Set `HOST_PASSWORD` to change from default password

3. **Prepare Questions**:
   - Edit `questions.txt` with your categories and questions
   - Format: Tab-separated values with categories in first row, prices in first column
   - Questions should be phrased as statements (contestants respond with questions)

4. **Start the Server**:
   ```bash
   npm start
   ```

5. **Access the Game**:
   - Open your browser and go to `http://localhost:3000`
   - **Default Host Password**: `jeopardy2025` (can be changed with environment variable `HOST_PASSWORD`)

## How to Play

### For the Host:
1. Open the game landing page (`http://localhost:3000`)
2. Click "Host Game" and enter the host password
3. Either create a new session or join an existing one with a session ID
4. Share the generated Session ID with contestants
5. Wait for contestants to join using the Session ID
6. Assign names to contestants as they connect
7. Click on dollar amounts to select questions
8. Judge answers as correct or incorrect
9. Manage Daily Doubles and Final Jeopardy

### For Contestants:
1. Get the Session ID from the host
2. Open the game landing page (`http://localhost:3000`)
3. Click "Join as Contestant"
4. Enter your desired display name (up to 20 characters)
5. Enter the Session ID provided by the host
6. Wait for the host to select questions
7. Click the "BUZZ IN" button (or press spacebar) to answer
8. Enter wagers for Daily Doubles and Final Jeopardy when prompted

## Game Rules

- **Regular Questions**: Correct answers add money, incorrect answers subtract money
- **Daily Doubles**: 
  - Contestant who buzzed in first sets the wager
  - Maximum wager is your current score or $1000, whichever is higher
- **Final Jeopardy**:
  - All contestants must wager before seeing answers
  - Maximum wager is your current score (minimum $1000 if score is negative)

## AI Question Generation

The game includes an AI-powered question generation feature using OpenAI's ChatGPT. This allows hosts to generate fresh, unique Jeopardy questions instantly.

### Setting Up AI Question Generation

1. **Get an OpenAI API Key**:
   - Sign up at https://platform.openai.com/
   - Navigate to API Keys section
   - Create a new API key

2. **Configure the Environment Variable**:
   - Set the environment variable `OPENAI_API_KEY` to your API key
   - For Railway deployment: Set `OPENAI_API_KEY` in the environment variables
   - For local development: Add to your `.env` file

3. **Using the Feature**:
   - In the Host interface, click "🤖 Generate New Questions"
   - The AI will create 30 new questions (5 price levels × 6 categories)
   - Questions are automatically saved and the game board is refreshed
   - All scores are reset when new questions are generated

### Features:
- Generates diverse, engaging questions across multiple categories
- Questions follow proper Jeopardy format (statements requiring question responses)
- Difficulty scales appropriately with dollar values
- Questions are saved to the CSV file for future use

## Question File Format

The `questions.txt` file should be tab-separated with this structure:

```
prices	CATEGORY1	CATEGORY2	CATEGORY3	CATEGORY4	CATEGORY5	CATEGORY6
200	Question 1	Question 1	Question 1	Question 1	Question 1	Question 1
400	Question 2	Question 2	Question 2	Question 2	Question 2	Question 2
600	Question 3	Question 3	Question 3	Question 3	Question 3	Question 3
800	Question 4	Question 4	Question 4	Question 4	Question 4	Question 4
1000	Question 5	Question 5	Question 5	Question 5	Question 5	Question 5
```

## Remote Play

### Local Network Access (Same WiFi/LAN)

To allow friends on the same network to join:

1. **Find your local IP address**:
   - Windows: `ipconfig` in Command Prompt
   - Mac/Linux: `ifconfig` in Terminal
   - Look for your network adapter's IP (usually starts with 192.168.x.x)

2. **Share the Session Information**:
   - Give contestants the Session ID (displayed after creating a session)
   - Contestants use: `http://YOUR_IP_ADDRESS:3000` and enter the Session ID
   - Example: contestants go to `http://192.168.1.100:3000`, click "Join as Contestant", and enter the Session ID

### External Access (Internet)

To allow friends from anywhere on the internet to join:

#### Quick Setup (Windows):
1. **Run the automated setup script as Administrator**:
   ```powershell
   .\setup-external-access.ps1
   ```
   This will configure Windows Firewall and show you your network details.

2. **Configure router port forwarding**:
   - Access your router admin panel (usually http://192.168.1.1 or http://192.168.0.1)
   - Find "Port Forwarding" or "Virtual Servers" section
   - Create a new rule:
     * External Port: 3000
     * Internal Port: 3000
     * Internal IP: [Your local IP from the script]
     * Protocol: TCP

3. **Test your setup**:
   ```powershell
   .\test-network.ps1
   ```

4. **Share your public IP**:
   - Find your public IP at https://whatismyipaddress.com/
   - Contestants connect to: `http://YOUR_PUBLIC_IP:3000`

#### Manual Setup:

1. **Configure Windows Firewall**:
   ```powershell
   # Run as Administrator
   New-NetFirewallRule -DisplayName "Jeopardy Game" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

2. **Configure Router Port Forwarding**:
   - Log into your router's admin interface
   - Forward external port 3000 to your computer's local IP on port 3000
   - Enable the rule

3. **Find Your Public IP**: 
   - Visit https://whatismyipaddress.com/
   - Share this IP with external contestants: `http://YOUR_PUBLIC_IP:3000`

#### Security Considerations for External Access:
- Only run the game server when actively hosting
- Use strong host passwords
- Monitor the console for connection logs
- Consider using a VPN service for additional security

## Customization

- **Host Password**: Set the `HOST_PASSWORD` environment variable to change from the default `jeopardy2025`
- **Port**: Change the port by setting the `PORT` environment variable
- **Questions**: Edit `questions.txt` to customize categories and questions
- **Styling**: Modify the CSS in the HTML files to change the appearance
- **Game Logic**: Adjust rules in `server.js` (Daily Double probability, scoring, etc.)

## Security Features

- **Host Authentication**: Password protection for creating and managing games
- **Session Isolation**: Each game runs in its own session with unique ID
- **Session Timeouts**: Inactive sessions are automatically cleaned up after 24 hours
- **IP Tracking**: Host can see contestant IP addresses for monitoring

## Technical Details

- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript
- **Real-time Communication**: WebSocket connections via Socket.IO
- **File Structure**:
  ```
  /
  ├── server.js          # Main server file
  ├── package.json       # Dependencies
  ├── questions.txt      # Game questions
  └── public/
      ├── index.html     # Landing page
      ├── host.html      # Host interface
      └── contestant.html # Contestant interface
  ```

## Troubleshooting

- **Can't connect**: Check firewall settings and ensure the server is running
- **Questions not loading**: Verify `questions.txt` format (tab-separated, proper structure)
- **Buzzer not working**: Make sure JavaScript is enabled and connection is stable
- **Performance issues**: Limit number of concurrent contestants (recommended: 3-6 players)

## Development

To run in development mode with auto-restart:

```bash
npm run dev
```

This requires `nodemon` which is included in the dev dependencies.

Enjoy your Jeopardy game!
