# Requirements Document

## 1. Application Overview

### 1.1 Application Name
Rescue Kaki - Integrated Field Operations Intelligence Tool

### 1.2 Application Description
Rescue Kaki is a mobile-optimized web application for incident commanders and field responders that captures, structures, and visualizes multi-source operational data (voice, visual, location, manual entries) into a unified timeline. The system enables offline data collection, real-time processing, and post-incident analysis through four integrated modules feeding a central timeline database.

### 1.3 Target Platform
Mobile-first web application optimized for smartphones and tablets, designed for field use with gloved hands in outdoor/low-light conditions. Dark tactical theme with orange/green accents.

## 2. Users and Usage Scenarios

### 2.1 Target Users
- Primary Users: Incident Commanders, Field Responders, Emergency Personnel
- Usage Context: Active incident response, field operations, emergency scenarios
- Device Constraints: Mobile devices with gloved hand operation, variable network connectivity

### 2.2 Core Usage Scenarios
- Logging verbal instructions and observations during incident response
- Documenting visual evidence with photos/videos at incident scenes
- Tracking movement and marking operational zones on schematic maps
- Recording structured assessments and reports
- Reviewing unified timeline of all field activities
- Exporting comprehensive incident data for post-analysis

## 3. Page Structure and Functionality

### 3.1 Application Structure
```
Rescue Kaki Application
├── Voice Tab (Module A)
│   ├── Status Bar
│   ├── Voice Recording Interface
│   ├── Voice Entry List
│   └── Pin on Schematic Prompt
├── Camera Tab (Module B)
│   ├── Camera Capture Interface
│   ├── Photo Preview
│   ├── Annotation Input
│   └── Pin on Schematic Prompt
├── Schematic Map Tab (Module C)
│   ├── Schematic Upload Interface
│   ├── Interactive Canvas
│   ├── Data Layer Controls
│   ├── GPS Calibration Interface
│   ├── Geofence Drawing Tool
│   ├── Settings Panel
│   └── Mini-Timeline
├── Log Tab (Module D)
│   ├── Template Selection
│   ├── Form Entry Interface
│   └── Pin on Schematic Prompt
├── Timeline Tab (Unified View)
│   ├── Time-Range Filter
│   ├── Search Bar
│   └── Multi-Module Entry Timeline
└── Bottom Navigation Bar
```

### 3.2 Bottom Navigation Bar
- Fixed position at bottom of screen
- Five navigation tabs:
  1. Voice (Module A icon)
  2. Camera (Module B icon)
  3. Schematic Map (Module C icon)
  4. Log (Module D icon)
  5. Timeline (Unified view icon)
- Large touch targets (minimum 60px)
- Active tab highlighted with orange/green accent

### 3.3 Module A: Voice Tab

#### 3.3.1 Status Bar
- Display current time (UTC)
- Show offline/online indicator
- Display total voice entry count

#### 3.3.2 Voice Recording Interface
- Large record button with three states: Idle, Recording, Processing
- Real-time transcription display during recording
- Automatic timestamp capture (UTC) when recording ends
- AI-generated summary from transcription
- Entry saved with: timestamp, summary, full transcription, optional location tag

#### 3.3.3 Pin on Schematic Prompt
- After recording stops and AI summary is generated, system displays Pin on Schematic prompt
- Show compact mini-map picker with schematic at reduced size
- User taps location on schematic where event occurred
- System records normalized X,Y coordinates and saves with entry
- User can skip pinning (entry saved without coordinates)
- Pin immediately appears on main schematic

#### 3.3.4 Voice Entry List
- Scrollable list of voice entries in reverse chronological order
- Each entry card shows: timestamp, summary (bold), collapsible full transcription
- Tap to expand/collapse transcription
- Edit icon to modify summary, transcription, or location tag

#### 3.3.5 Search and Export
- Search bar filters entries by keywords in summary or transcription
- Export button downloads voice entries as JSON or CSV

### 3.4 Module B: Camera Tab

#### 3.4.1 Camera Capture Interface
- Large capture button using browser file input or camera API
- Support photo and short video capture
- Automatic timestamp capture (UTC) when media captured
- Automatic geolocation capture (latitude, longitude) if available

#### 3.4.2 Photo Preview and Annotation
- Thumbnail preview of captured media
- Text input field for caption/annotation
- Save button to store entry
- Each photo entry contains: timestamp, geolocation (if available), caption text, media file reference

#### 3.4.3 Pin on Schematic Prompt
- After photo is saved, system displays Pin on Schematic prompt
- Show compact mini-map picker with schematic at reduced size
- User taps location on schematic where photo was taken
- System records normalized X,Y coordinates and saves with entry
- User can skip pinning (entry saved without coordinates)
- Pin immediately appears on main schematic

#### 3.4.4 Photo Entry List
- Scrollable list of photo entries in reverse chronological order
- Each entry card shows: thumbnail, timestamp, geolocation, caption
- Tap to view full-size image
- Edit icon to modify caption

### 3.5 Module C: Schematic Map Tab

#### 3.5.1 Schematic Upload Interface
- When no schematic uploaded, display onboarding prompt with instructions
- Upload button allows user to select floor plan image (JPG/PNG, max 20MB)
- Uploaded image stored in Supabase Storage
- Schematic persists across sessions (stored in schematic_settings table)
- User can replace schematic at any time via settings panel

#### 3.5.2 Interactive Canvas
- Full-height canvas displaying schematic image
- Pan: drag to move around schematic
- Zoom: pinch-to-zoom on touch, scroll wheel on desktop
- Zoom range: 0.5x to 5x
- Schematic image fills canvas area
- All pin coordinates stored as normalized values (X: 0.0–1.0, Y: 0.0–1.0) relative to image dimensions

#### 3.5.3 Data Layer 1 — Entry Pins
- All entries from all modules with schematic coordinates appear as pins on map
- Color-coded by module type:
  - Voice entries: orange pin
  - Photo entries: green pin
  - GPS zone labels: blue pin
  - Manual log entries: purple pin
- Tap/click pin to open detail card popup showing: timestamp, module badge, summary, key content (transcription excerpt, photo thumbnail, form fields)
- Pins scale correctly as user zooms in/out

#### 3.5.4 Data Layer 2 — GPS Breadcrumb Trail
- GPS tracking points manually calibrated to schematic appear as connected polyline on canvas
- Active tracking position shows as pulsing orange circle
- GPS tracking uses browser Geolocation API (watchPosition)
- Positions mapped to schematic coordinates through calibration

#### 3.5.5 Data Layer 3 — Geofence Overlays
- User can draw circular geofence zones directly on schematic
- Tap and hold on point, drag to set radius
- Enter zone name (e.g., Hot Zone, Safe Zone, Exclusion Zone)
- Geofences appear as semi-transparent colored circles with labels
- Stored with center (X, Y) and radius in normalized units

#### 3.5.6 GPS Calibration Interface
- User taps two known reference points on schematic
- For each point, user either enters real GPS coordinates manually or uses device current GPS position
- System stores 2-point affine transform (two calibration pairs) to convert future GPS readings to schematic coordinates
- After calibration, breadcrumb trail automatically plots on schematic
- Calibration can be reset and redone

#### 3.5.7 Map Tab UI Layout
- Full-height canvas taking up most of tab
- Top toolbar: zoom controls, layer toggles (show/hide each data layer), settings icon
- Floating action button (bottom right): opens quick-add menu for placing manual pin or geofence
- Below canvas: collapsible mini-timeline showing only entries with schematic coordinates in chronological order

#### 3.5.8 Settings Panel
- Accessible from Map tab header settings icon
- Options:
  - Replace schematic
  - Reset calibration
  - Clear all pins
  - Export schematic as PNG with all overlays

### 3.6 Module D: Log Tab

#### 3.6.1 Template Selection
- Four predefined form templates:
  1. Victim Assessment
  2. Equipment Check
  3. Hazard Report
  4. General Note
- User selects template to open corresponding form

#### 3.6.2 Form Templates

**Victim Assessment Form:**
- Victim Count: Number input
- Condition: Dropdown (Stable, Critical, Deceased)
- Location: Text input
- Notes: Text area

**Equipment Check Form:**
- Equipment Name: Text input
- Status: Dropdown (OK, Damaged, Missing)
- Quantity: Number input
- Notes: Text area

**Hazard Report Form:**
- Hazard Type: Text input
- Severity: Dropdown (Low, Medium, High, Critical)
- Location: Text input
- Description: Text area

**General Note Form:**
- Subject: Text input
- Body: Text area

#### 3.6.3 Form Submission
- Submit button saves entry with: timestamp (UTC), template type, all field values, optional location tag
- Cancel button discards entry
- Submitted entries appear in unified timeline

#### 3.6.4 Pin on Schematic Prompt
- After form is submitted, system displays Pin on Schematic prompt
- Show compact mini-map picker with schematic at reduced size
- User taps location on schematic where event occurred
- System records normalized X,Y coordinates and saves with entry
- User can skip pinning (entry saved without coordinates)
- Pin immediately appears on main schematic

#### 3.6.5 Manual Entry List
- Scrollable list of manual entries in reverse chronological order
- Each entry card shows: timestamp, template type badge, key field values
- Tap to expand full entry details
- Edit icon to modify field values

### 3.7 Timeline Tab (Unified View)

#### 3.7.1 Unified Timeline Display
- Scrollable list showing ALL entries from all modules in reverse chronological order
- Each entry card styled with color-coded module badge:
  - Voice entries: Orange badge
  - Photo entries: Green badge
  - GPS/Zone entries: Blue badge
  - Manual log entries: Purple badge
- Entry card content varies by module type:
  - Voice: Summary + transcription preview
  - Photo: Thumbnail + caption
  - GPS: Zone label + coordinates
  - Manual: Template type + key fields
- Entries with schematic coordinates show map-pin icon
- Tapping map-pin icon opens Map tab zoomed to that pin location

#### 3.7.2 Time-Range Filter
- Start Time input (date-time picker)
- End Time input (date-time picker)
- Apply Filter button
- Clear Filter button
- Display only entries within selected time range

#### 3.7.3 Full-Text Search
- Search bar at top of timeline
- Search across all entry types: voice transcriptions, photo captions, zone labels, manual log fields
- Real-time filtering as user types
- Display matching entries only

#### 3.7.4 Unified Export
- Export All button
- Export formats: CSV or JSON
- Exported file includes all entries from all modules with fields: timestamp, module type, content summary, geolocation (if available), schematic coordinates (if available), full data

## 4. Business Rules and Logic

### 4.1 Data Storage Rules
- All structured data (entries, metadata) stored in Supabase database
- Unified entries table with module_type field distinguishing entry source
- Add schematic_x DOUBLE PRECISION (nullable) and schematic_y DOUBLE PRECISION (nullable) columns to entries table
- Photo/video files and schematic images stored in Supabase Storage bucket
- New schematic_settings table with: id, image_url, calibration_data (jsonb), created_at
- GPS breadcrumb points stored in entries table with module_type='gps' and schematic coordinates (after calibration)
- New geofences table: id, label, zone_type, center_x, center_y, radius, color, created_at
- No user authentication required (anonymous/public access for POC)
- Data persists across sessions

### 4.2 Timestamp Rules
- All entries capture UTC timestamp at moment of creation/capture
- Timestamps used for chronological ordering in all views
- Time-range filter operates on UTC timestamps

### 4.3 Schematic Coordinate Rules
- All pin coordinates stored as normalized values (X: 0.0–1.0, Y: 0.0–1.0) relative to schematic image dimensions
- Normalized coordinates ensure pins remain accurate at any zoom level
- Entries without schematic coordinates stored with null schematic_x and schematic_y values
- Geofence center coordinates and radius stored in normalized units

### 4.4 Voice Processing Rules (Module A)
- Recording uses Web Speech API (SpeechRecognition) for real-time transcription
- When recording ends: transcription finalized, sent to LLM (Gemini via Edge Function) for summarization
- Entry saved with timestamp, summary, full transcription, optional location tag
- After AI summary generated, Pin on Schematic prompt displayed

### 4.5 Photo Processing Rules (Module B)
- Camera capture uses browser file input or camera API
- Media files uploaded to Supabase Storage
- Entry saved with timestamp, geolocation, caption, storage file reference
- Thumbnail generated for timeline display
- After photo saved, Pin on Schematic prompt displayed

### 4.6 Schematic Map Rules (Module C)
- Schematic image uploaded as JPG/PNG (max 20MB) stored in Supabase Storage
- Schematic persists across sessions via schematic_settings table
- User can replace schematic at any time
- When no schematic uploaded, onboarding prompt displayed
- All data layers (entry pins, GPS breadcrumb trail, geofences) rendered on schematic canvas
- Pan and zoom interactions apply to all layers simultaneously
- Layer toggles allow show/hide of individual data layers

### 4.7 GPS Calibration Rules
- User selects two reference points on schematic
- For each point, user provides real GPS coordinates (manual entry or current device position)
- System stores 2-point affine transform as calibration_data in schematic_settings table
- After calibration, all future GPS readings converted to schematic coordinates using transform
- GPS breadcrumb trail automatically plots on schematic after calibration
- Calibration can be reset and redone

### 4.8 Geofence Rules
- User taps and holds on schematic point, drags to set radius
- User enters zone name
- Geofence saved with center (X, Y), radius (normalized units), label, color
- Geofences rendered as semi-transparent colored circles with labels on schematic

### 4.9 Pin on Schematic Workflow
- After entry data captured in Voice, Camera, or Log tabs, Pin on Schematic prompt displayed
- Compact mini-map picker shows schematic at reduced size
- User taps location on schematic
- System records normalized X,Y coordinates and saves with entry
- User can skip pinning (entry saved without coordinates)
- Pin immediately appears on main schematic

### 4.10 Manual Log Rules (Module D)
- User selects template, fills form fields, submits entry
- Entry saved with timestamp, template type, all field values, optional location tag
- Form validation ensures required fields completed before submission
- After form submitted, Pin on Schematic prompt displayed

### 4.11 Unified Timeline Rules
- Timeline aggregates entries from all modules ordered by timestamp
- Time-range filter applies to all module types simultaneously
- Search matches keywords in all text fields across all modules
- Export includes all entries with module type identifier and schematic coordinates (if available)
- Entries with schematic coordinates display map-pin icon
- Tapping map-pin icon opens Map tab zoomed to pin location

### 4.12 Edit Rules
- Users can edit text fields in all entry types (except timestamp)
- Edits saved immediately to Supabase database
- Original data overwritten (no version history in POC)

### 4.13 Offline Behavior
- Application functions offline for data capture
- Entries queued locally when offline
- Automatic sync to Supabase when connection restored
- Offline indicator displayed in status bar

## 5. Exceptions and Edge Cases

| Scenario | System Behavior |
|----------|----------------|
| User attempts to pin entry when no schematic uploaded | Display message \"Please upload a schematic first\", skip pinning step |
| User uploads schematic image exceeding 20MB | Display error message \"File size exceeds 20MB limit\", prevent upload |
| User uploads unsupported file format | Display error message \"Only JPG and PNG formats supported\", prevent upload |
| GPS calibration attempted with fewer than 2 reference points | Display error message \"Two reference points required for calibration\" |
| GPS calibration reference points are identical | Display error message \"Reference points must be distinct\" |
| User attempts to draw geofence when no schematic uploaded | Display message \"Please upload a schematic first\", disable geofence tool |
| User taps pin on schematic but detail card fails to load | Display error message \"Unable to load entry details\", retry on tap |
| Schematic image fails to load from Supabase Storage | Display error message \"Schematic unavailable\", show placeholder |
| User exports schematic as PNG but rendering fails | Display error message \"Export failed\", retry option |
| User captures photo without geolocation permission | Entry saved with null coordinates, caption still captured |
| Voice transcription fails | Entry saved with empty transcription, user can manually edit |
| LLM summarization fails or times out | Entry saved with transcription only, summary shows \"Summary unavailable\" |
| Supabase Storage upload fails | Display error message, retry upload when connection restored |
| User submits manual log form with missing required fields | Display validation error, prevent submission until fields completed |
| Time-range filter start time is after end time | Display error message, swap values automatically |
| Search query returns no results | Display \"No matching entries found\" message |
| User attempts to export with no entries | Display message \"No data to export\" |
| Browser does not support Geolocation API | Display error message, disable GPS tracking features |
| Browser does not support Web Speech API | Display error message, disable voice recording feature |
| Supabase connection fails during sync | Queue entries locally, display sync pending indicator, retry periodically |
| User edits entry while offline | Edit saved locally, synced to Supabase when connection restored |
| User zooms beyond 5x limit | Zoom stops at 5x, display message \"Maximum zoom reached\" |
| User zooms below 0.5x limit | Zoom stops at 0.5x, display message \"Minimum zoom reached\" |

## 6. Acceptance Criteria

1. User opens Rescue Kaki application on mobile device
2. User navigates to Schematic Map tab, uploads floor plan image (JPG, 15MB)
3. System stores schematic in Supabase Storage, displays schematic on canvas
4. User navigates to Voice tab, records verbal instruction
5. System displays transcription and AI summary, shows Pin on Schematic prompt
6. User taps location on mini-map picker, pin saved with normalized coordinates
7. User navigates to Camera tab, captures photo of incident scene
8. System captures geolocation, user adds caption, shows Pin on Schematic prompt
9. User taps location on mini-map picker, pin saved with normalized coordinates
10. User navigates to Schematic Map tab, taps two reference points for GPS calibration
11. User enters real GPS coordinates for each point, system stores calibration transform
12. User starts GPS tracking, moves through incident area
13. System plots breadcrumb trail on schematic using calibrated coordinates
14. User taps and holds on schematic, drags to create geofence, enters \"Hot Zone\" label
15. System saves geofence with center coordinates and radius, displays on schematic
16. User navigates to Log tab, selects Hazard Report template
17. User fills form fields (Hazard Type: Fire, Severity: High, Location: Building A, Description: Active flames on second floor)
18. User submits form, shows Pin on Schematic prompt, user taps location on mini-map picker
19. User navigates to Timeline tab
20. System displays unified timeline with all entries (voice, photo, hazard report) in chronological order with color-coded badges and map-pin icons
21. User taps map-pin icon on voice entry, system opens Map tab zoomed to that pin location
22. User applies time-range filter to view entries from last 30 minutes
23. User enters search keyword \"fire\" in search bar, system filters to show matching entries
24. User taps Export All button, downloads JSON file containing all timeline entries with schematic coordinates

## 7. Features Not Included in This Release

- User authentication or multi-user accounts
- Cloud synchronization across multiple devices
- Audio playback of original voice recordings
- Video playback within app (videos exported only)
- Advanced map features (heatmaps, route optimization, area measurement)
- GPS track editing or manual coordinate entry
- Photo editing tools (crop, rotate, filters)
- Drawing/annotation overlay on photos
- EXIF metadata extraction or display
- Speaker diarization in voice transcriptions
- Keyword flagging or sentiment analysis
- Custom form template creation
- Entry deletion capability
- Version history or undo/redo for edits
- Data encryption or advanced security features
- Export to Word or PDF formats
- Sorting options other than chronological
- Filtering by module type or location radius
- Dark/light theme toggle (dark theme is default)
- Accessibility features beyond large touch targets
- Battery usage monitoring or optimization
- Offline map tile caching
- Real-time collaboration or shared logs
- Integration with external hardware (walkie-talkies, body cameras)
- Automatic backup scheduling
- Data compression or storage optimization
- Custom LLM model training
- NLP analysis or report generation
- Cross-referencing engine or advanced query API
- Multi-schematic support (switching between multiple floor plans)
- 3D schematic rendering
- Schematic rotation or orientation adjustment
- Automatic schematic alignment or georeferencing
- Polygon or freeform geofence shapes
- Geofence alerts or notifications
- Pin clustering at high zoom-out levels
- Custom pin icons or colors
- Measurement tools (distance, area) on schematic
- Schematic layer management (multiple overlays)
- Collaborative schematic editing
- Schematic version control