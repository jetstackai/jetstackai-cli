Help me set up the JetStack AI CLI for this project.

1. First check if `jetstackai` is installed by running `jetstackai --version`. If not installed, run `npm install -g @jetstackai/cli`.

2. Check if already authenticated by running `jetstackai auth status`. If connected, show the status and stop.

3. If not authenticated, tell me:
   - Go to the JetStack AI dashboard → Settings → Access Tokens
   - Copy the **Instance ID** and **Access Token**
   - Then run `jetstackai auth login` and paste both values when prompted

4. After authentication, verify by running `jetstackai portals list --format table` to show connected portals.

5. Confirm the setup is complete and show what commands are available.
