## Show Next Room for all Doctors in Gentile Retina!

### Functions included in this program:

* Extract the 'p' element containing "Exam" and the corresponding 'li' information from the current page.
* Extract information such as Doctor, Type, CheckIn from the title of 'li', and determine the Type category based on keywords.
* Parse the patient's name (LastName, FirstName) from the text of 'li'.
* Call the specified API to obtain the name and CheckIn time data. If the corresponding patient is matched, update the patient's Check In time to the * API return value.
* Group by Doctor and sort up to the first three elements in each group:
* Elements with underline style take priority.
* Sort by CheckIn time.
* If the time is close and the type is I/E/N, adjust the sorting according to the type priority.
* Display the results in the floating window in the lower right corner of the page, and display its CheckIn after each Exam.
* There is a "Refresh" button in the floating window for manual refresh, and a "Modify Check In Time" button to open the specified URL.
* Automatically refresh the data once after the page loads for 1 second.


### Updates
* Update 12/11/2024 1.5.1 Will only show the room information, fixed some bugs
* Update 12/11/2024 1.5 Added the function of manually modifying the check in time
* Update 12/10/2024 1.4 The type of patient will be considered
* Update 12/06/2024 1.3 Add the feature that the program will first check if a patient is set to be the next
* Update 12/06/2024 1.2 Fixed some bugs
* Update 12/04/2024 1.1 Fixed some bugs
* Update 12/03/2024 1.0 Calaulate the order based on check in time
