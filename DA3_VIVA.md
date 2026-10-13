# Cloud DA3 Viva — Intelligent Crowd Monitoring

**One-minute explanation:** Our existing system simulates campus crowd counts and applies DBSCAN. I added a CloudWatch-style monitoring tab that records these counts as a custom metric, evaluates an alarm, records transitions, and creates a clearly labeled simulated SNS notification. My enhancement classifies crowd severity and recommends a less crowded connected campus zone. The original crowd-management features remain available. This is a local simulation, with no real AWS calls or messages.

**What is Amazon CloudWatch?**
AWS's monitoring and observability service. It collects metrics and other telemetry and supports dashboards and alarms. This assignment focuses on custom metrics and metric alarms.

**Why did you choose CloudWatch?**
Crowd counts change over time. Metrics describe that change, while alarms identify congestion episodes and trigger actions when the alarm state changes.

**What is a CloudWatch metric?**
A time-ordered set of measurements. Here the metric is `CrowdCount`, its unit is `Count`, and each observation uses the existing zone population.

**What is a namespace?**
A container that groups related CloudWatch metrics. Our custom namespace is `College/CrowdManagement`.

**What is a dimension?**
A name/value pair that helps identify a metric's particular time series. We use `Location = North Square`; another Location value identifies another time series.

**What is a CloudWatch alarm?**
A rule that evaluates a metric against configured conditions over evaluation periods and can invoke actions when its state changes. Our simplified alarm is `HighCrowdAlarm-North`, with `CrowdCount > 70` by default.

**What do OK, ALARM and INSUFFICIENT_DATA mean?**
OK means the available evaluation window does not satisfy the alarm condition. ALARM means it does. INSUFFICIENT_DATA means there is not enough usable data to decide. Our demo uses that state initially, after configuration changes, or after 20 seconds without new observations.

**How does your evaluation work?**
The existing generator updates every five seconds. With N set to 2, both of the two latest observations must exceed the threshold. With fewer than two observations we show INSUFFICIENT_DATA. One nonbreaching sample in the complete window gives OK. Actual AWS evaluates statistics over time periods, rather than this simplified sample window.

**Why is a count of exactly 70 HIGH but the alarm still OK?**
Severity and alarm conditions are separate configurations. The default HIGH range begins at 70, but the alarm uses a strict greater-than comparison, so 70 is not a breach.

**Why shouldn't an SNS message be generated for every sample?**
Repeated samples can describe the same continuing congestion episode. Sending every time would create noise. We notify on entry to ALARM and allow one additional escalation to CRITICAL per alarm episode.

**What is Amazon SNS?**
Amazon Simple Notification Service is a managed publish/subscribe messaging service. Publishers send messages to topics, and subscribed endpoints receive them. Our notification entries demonstrate this concept without actual delivery.

**Why use SNS with CloudWatch?**
A CloudWatch alarm can target an SNS topic so its state transition can notify subscribed users or applications.

**What exactly did you simulate?**
A namespace, metric, Location dimension, timestamped observations, configurable threshold, N-of-N evaluation, three alarm states, transition/configuration history, missing-data handling, and a labeled simulated SNS action. Histories are stored in backend memory, independently of the unchanged MongoDB crowd records.

**What is the enhancement?**
Configurable NORMAL/MODERATE/HIGH/CRITICAL classification and a connected-zone recommendation. For HIGH or CRITICAL crowds we rank less crowded neighbors by count, exclude zones at 85% occupancy or above, and explain when no suitable alternative exists. A critical-escalation notification is additional application logic.

**Where does the crowd data come from?**
The original application's Wi-Fi/network-activity simulator and DBSCAN pipeline. It is simulated crowd data, not camera footage or actual student tracking. Demo controls inject predictable counts into that same generator.

**Are the alternative locations real data?**
The locations and connections come from the existing campus model. Counts in live mode come from the original simulator. During the deterministic demo, up to two connected alternatives are fixed at 48 and 31 and labeled as simulated. For North Square they are Admin Block and Gazebo.

**How would this connect to real AWS?**
A trusted backend would use `PutMetricData` for the custom metric. We would provision CloudWatch alarms using AWS-compatible periods and statistics, attach an SNS topic as an alarm action, and confirm notification subscriptions. Recommendation logic remains application code; it could run in a backend or Lambda subscriber.

**How would it scale to multiple college gates?**
Publish a separate Location dimension value and configure an alarm for each gate. This version already separates state and history by campus location. A deployed multi-instance system needs shared/durable state, a real gate topology, location-specific thresholds and fresh alternative counts.

**What happens if crowd data stops arriving?**
After 20 seconds the alarm enters INSUFFICIENT_DATA, old observations are marked stale, and recommendations are withheld. The evaluation buffer is cleared. Resume ingestion to collect new observations. In actual AWS the alarm's missing-data policy determines how missing periods are handled.

**What security precautions are needed for real AWS?**
Keep AWS calls on the backend. Use IAM roles and least-privilege policies, authenticate administrative actions, restrict SNS publish permissions and CORS, use HTTPS, and keep secrets out of frontend bundles and GitHub.

**What are the limitations?**
No real AWS or real student detection; no email/SMS delivery. Monitoring histories/configuration reset on backend restart. Demo controls are shared by viewers. Evaluation is sample-based, not the full CloudWatch algorithm. Recommendations use modeled connections and current spare capacity, not a guaranteed evacuation plan.

**How do I show it to faculty?**
North Square → Normal (35, OK) → Surge (35/47/59/68/76/87/94) → at 76 show OK → ALARM and simulated SNS → at 94 show CRITICAL and Gazebo → hold 94 to demonstrate no spam → Normalize → at 68 show ALARM → OK → return to live simulation. Full commands and steps are appended to README.

References: [CloudWatch concepts](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html), [CloudWatch alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Alarms.html), [PutMetricData](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_PutMetricData.html), [Amazon SNS](https://docs.aws.amazon.com/sns/latest/dg/welcome.html).


**How do saved bookings connect to CloudWatch monitoring?**
Saving registers the event's existing venue, expected attendance and time window with a separate booking alarm. The monitoring tab opens at that event. Upcoming events are armed, active events evaluate the venue count, and completed/cancelled events stop generating attendance alerts. Registrations are restored from MongoDB after a backend restart.

**What if more people arrive than planned?**
If the active event's venue count exceeds expected attendance, its booking alarm enters ALARM and creates a Simulated SNS Notification containing the event, actual venue count, planned count and recommendation. Exceeding venue capacity is CRITICAL and can create one escalation notification. Repeated samples do not spam messages; recovery is recorded as ALARM → OK.

**Do you know the exact number of event attendees?**
No. We use the existing whole-venue crowd count as an attendance estimate, which can include bystanders. The project still simulates crowd input and SNS delivery. Actual deployment would require an event-specific counting source or entry/exit data and real AWS integration.
