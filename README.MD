# This is the File for add the feature of show next room for Gentile Retina.

Functions included in this program:

Extract the <p> element containing "Exam" and the corresponding <li> information from the current page.
Extract information such as Doctor, Type, CheckIn from the title of <li>, and determine the Type category based on keywords.
Parse the patient's name (LastName, FirstName) from the text of <li>.
Call the specified API to obtain the name and CheckIn time data. If the corresponding patient is matched, update the patient's Check In time to the API return value.
Group by Doctor and sort up to the first three elements in each group:
Elements with underline style take priority.
Sort by CheckIn time.
If the time is close and the type is I/E/N, adjust the sorting according to the type priority.
Display the results in the floating window in the lower right corner of the page, and display its CheckIn after each Exam.
There is a "Refresh" button in the floating window for manual refresh, and a "Modify Check In Time" button to open the specified URL.
Automatically refresh the data once after the page loads for 1 second.

