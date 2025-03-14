# Matrix Chat Integration Testing Guide

This document provides a comprehensive guide for testing the Matrix chat integration in OpenMeet. It outlines both manual testing procedures and automated test cases to verify the Matrix functionality works correctly across events and groups.

## Overview of Matrix Integration

Matrix is used as the underlying technology for all chat functionality in OpenMeet:
- Each event and group has a dedicated Matrix room
- Messages are sent in real-time and persist across sessions
- Typing indicators show when users are typing
- User presence is tracked to show active/inactive status
- Users are automatically provisioned with Matrix accounts when needed

## Prerequisites for Testing

1. A valid OpenMeet account with login credentials
2. At least one test event that you can access (preferably one you created)
3. A second browser or incognito window to test user interactions

## Manual Testing Walkthrough

### 1. Basic Matrix User Provisioning Test

**Objective**: Verify that a new user automatically gets provisioned with Matrix credentials.

**Steps**:
1. Create a new OpenMeet test account or clear your browser storage
2. Log into OpenMeet
3. Navigate to an event page that has discussions enabled
4. Attempt to post a comment in the discussion section

**Expected Results**:
- User should be able to post a comment without any explicit Matrix setup
- In browser dev tools (Network tab), you might see a call to `/api/matrix/provision-user`
- Comment should appear in the discussion thread immediately

### 2. Event Discussion Functionality Test

**Objective**: Verify Matrix chat integration works correctly in event discussions.

**Steps**:
1. Log in to OpenMeet
2. Create a new event by clicking "Create Event" in dashboard
3. Fill in required details and save
4. Navigate to the event page
5. Scroll down to the "Comments" section
6. Type a message in the input field and send it
7. Open the same event in a different browser or incognito window (logged in as another user)
8. Verify the message is visible
9. Reply to the message from the second account

**Expected Results**:
- Messages should appear in real-time for both users
- Messages should persist if you refresh the page
- Both users should see each other's messages

### 3. Typing Indicators Test

**Objective**: Verify typing indicators work correctly.

**Steps**:
1. Open an event discussion in two different browsers or windows (as two different users)
2. In one window, start typing in the comment box
3. Observe the other window

**Expected Results**:
- User who is typing should see their message being typed
- Other user should see a "[User] is typing..." indicator
- Indicator should disappear a few seconds after typing stops

### 4. Auto-Provisioning Test

**Objective**: Verify that Matrix user provisioning happens automatically when needed.

**Steps**:
1. Create a new OpenMeet account or use an existing one without Matrix activity
2. Navigate to a page with chat functionality (event page or group page)
3. Examine the network requests in browser dev tools when attempting to send a message

**Expected Results**:
- A call to `/api/matrix/provision-user` should be made automatically the first time
- User should be able to send messages without any interruption or explicit setup
- After provisioning, the Matrix user ID should be associated with the account

### 5. Multi-Device Persistence Test

**Objective**: Verify that chat messages persist across different devices and sessions.

**Steps**:
1. Log in to OpenMeet on a desktop browser
2. Send a few messages in an event discussion
3. Log out and log back in on a different device or browser
4. Navigate to the same event

**Expected Results**:
- All previously sent messages should be visible
- Chat history should be consistent across devices

### 6. Room Creation Test

**Objective**: Verify that Matrix rooms are created automatically when events or groups are created.

**Steps**:
1. Create a new event through the dashboard
2. Navigate to the event page
3. Check if the discussion/comments section is available
4. Try to send a message

**Expected Results**:
- Comments section should initialize properly
- Messages should be sendable without errors
- If you examine network requests, a Matrix room ID should be associated with the event

### 7. Error Recovery Test

**Objective**: Verify that the chat system recovers from connection errors.

**Steps**:
1. Open an event page with discussion
2. Disconnect from the internet (turn off wifi or use browser dev tools to simulate offline)
3. Try to send a message
4. Reconnect to the internet
5. Try to send another message

**Expected Results**:
- Offline message should show an error or get queued
- After reconnecting, new messages should send successfully
- Connection status might be indicated in the UI

## Automated Test Cases

For Cypress test development, here are the key test cases that should be automated:

1. **User Provisioning Test**
   - Verify a new user gets Matrix credentials automatically
   - Check that credentials persist across page refreshes

2. **Message Sending Test**
   - Send a message to a room
   - Verify message appears in the UI
   - Verify message persists after refresh

3. **Real-time Updates Test**
   - Simulate receiving a Matrix event via the event system
   - Verify UI updates accordingly

4. **Typing Indicators Test**
   - Send typing indicator
   - Verify typing status is sent to the server
   - Simulate receiving typing indicator from another user
   - Verify typing indicator appears and disappears correctly

5. **Room Creation Test**
   - Create a new event
   - Verify Matrix room is created
   - Verify messages can be sent in the new room

## Troubleshooting Common Issues

### Matrix User Provisioning Failures

If a user cannot send messages and the Matrix provisioning fails:
- Check network requests for errors in the `/api/matrix/provision-user` endpoint
- Verify that Matrix server is operational
- Check that the user has the correct permissions to participate in the discussion

### Missing Messages

If messages are not appearing:
- Verify the Matrix room ID is correctly associated with the event/group
- Check network requests for errors in message sending
- Verify that the WebSocket connection is established for real-time updates

### Typing Indicators Not Working

If typing indicators don't appear:
- Check network requests for `/api/matrix/*/typing` endpoint
- Verify WebSocket connection is active
- Check permissions to ensure users can see each other's typing status

## Reporting Issues

When reporting Matrix-related issues, please include:
1. Steps to reproduce the issue
2. Expected vs. actual behavior
3. Browser and device information
4. Network request logs (if possible)
5. Error messages from browser console
6. Screenshots of the issue

## Conclusion

The Matrix integration provides real-time chat functionality throughout OpenMeet. By following this testing guide, you can ensure the chat system works correctly across different scenarios and user interactions. Regular testing is essential as the Matrix integration evolves with new features and improvements.