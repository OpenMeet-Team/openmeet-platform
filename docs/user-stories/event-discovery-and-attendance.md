---
# Event Discovery & Attendance Flow

## Discovery Phase
Sarah is not logged in and browsing OpenMeet's event listings for photography workshops in her area. She finds
"Urban Photography Walk - Downtown" which is listed as a public event hosted by the Local Photography Club.

The event listing shows:
- Basic details (date, time, location)
- 12 spots remaining out of 20 total

## Interest & Requirements Phase
Sarah clicks or scrolls to view more details and sees:
- Full event description
- Current attendee list
- Requirements for attendance:
  1. Must be a member of Local Photography Club
  2. Must have a DSLR camera (equipment requirement)
  3. Requires host approval

## Joining Process
1. Sarah joins the Local Photography Club (separate group membership flow)
2. Returns to event and clicks "Request to Attend"
3. Fills out attendance questionnaire (if the host created one):
   - What camera equipment she'll bring
   - Her experience level
   - Why she wants to attend
4. Submits request and sees "Pending Host Approval"

## Confirmation Phase
- Host reviews Sarah's request and her profile
- Host approves Sarah's attendance
- Sarah receives confirmation email with:
  - Final event details
  - Meeting point information
  - What to bring
  - How to contact organizers

## Flow Classification
This story illustrates how the three key aspects interplay:
- **Discoverability**: Listed (Sarah found it in search)
- **Access**: Restricted (requires group membership)
- **Confirmation**: Manual (host approval required)


## Notes

- how to enforce the group membership requirement? Is it automatic or is the host validating that?
- what happens if the host doesn't approve the attendance? What does the user see?
-
---
# Invite-Only Group Event Flow

## Host Creation Phase
Jane, a local parent, creates a small birthday party event for her 5-year-old:
- Sets event as "Invite Only"
- Limits to 8 children total
- Specifies age range 4-6 years
- Adds details about:
  - Location (her backyard)
  - Time and duration
  - Activities planned
  - Food being served
  - Note about parent attendance required

## Invitation Process
1. Jane can invite families in multiple ways:
   - Select directly from her trusted group members
   - Share personal invitation links via email
   - Share QR code in person (e.g., at school pickup)
   - Generate invitation links to share via messaging apps
2. Each invited parent receives/sees:
   - Event details upon following link/scanning QR
   - Option to RSVP with information like
     - Number of children attending
     - Any allergies or dietary restrictions

## Attendance Management
- Only invited parents can see full event details
- Event doesn't appear in group calendar or search
- RSVPs automatically close when limit reached
- Host can see who has viewed/responded
- Host can send reminders to pending invites

## Privacy & Safety
- Attendance list only visible to invited families
- Photos/sharing permissions set by host

## Summary
This is an example of:
- Highly restricted discoverability
- Strict access control
- But simple/automatic confirmation process
