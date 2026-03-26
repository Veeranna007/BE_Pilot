-database name is company name 
-collectionName is fmsCollection
-add these thwo values in .env file
-add router 
-create repo and push the code // merge the code to main backend
-create login pool initialisation based on user -- connect to that specific company db
-eachdb is one company 
-each db has multiple collections for that company , fms master and detail fms
-whenever an fms is initialised for the first time , approval has to be done -- add names on who to approve this(optioanl feature)
-who has access to this fms -change it to fmsFormAccess  - store ID's
-fmsQuestionare change it to fmsInitialForm
-in questionare  - ignore startEndDateTime
-fmsQuestionaeAccess - store both ID and name in an object and make it array of objects 
-add a key for each fms  - at what point is this fms live (live or not live -- status -- give it a boolean - true after all steps are completed and saved(in view fms))


steps
what has to be done - description
who - if all shift - can be assigned to only 1 person
    - if it is Individual Shift 
    - save the shift id and employee id ( for individual shift)
when will you do this step - STRING
How will you do this step
    1) none  - STRING -- add a training link ( how to do a task , maybe an Youtube link)
    2)Checklist - check with salman for frequescy part of Checklist
                -RENAME IT TO CHECKLIST steps FROM MINI STEPS
                -SUBSETS Check with salman
    -Form is there even for checklist and reference format
    -in reerence format there will only be instructions to do that step - array of strings
    -in every step - in how  - the form is non mandatory
    -whatever we do in how , that will be the payload for the task
-lastkey for every step is "type" - "doer" or "quality"
-by default the type is "doer"
-create a step id
-create a fms id as well******************************************
-steps - start time - by default previous steps actual date time (for now ignore the start time)
-T-X --> duration is some , start time is not previous step time , dropdown i need send all the date time formats as options -- T is date time and x is number*hr or d



--location was is not required
--how - (checklist , reference, none) - either of these 3 


--fms initialisdation name - give an option to change it 

ngrok token  -2fHbiUaddJBLgvfxUdXfxCoVbXQ_4KJMC3ATzhSn5EwAq2Xt6


from token get yser id and company
for ansewr q - use same payload 
after submitting calculate planned time and create that task
get a few fms from ahana
after form submission - calculate planned date and time and add task and send notification 
api to get fms tasks
in the tasks - send only overdue and todays tasks in the api
add a status for every step
create db and collection in mongodb once a company is registered

--all fms
--all request formats
--submit qa

create task for a user
fmsMasterId, fmsQAID, taskID , userID(who ??), processid, status(delayed, on time), createdtime(formSubmissionTime), plannedEndTime(time in hrs, time in days), 


-remove duplicates when initializing fms - basically remove the upsert and test it out



/////////////////////////////////////
-change mongo GMT time to IST in create task api ( update task api , submitfmsQA)
-CHECK ALL TASKS( THAT ARE PENDING) , FETCH THE PLANNED START TIME , PLANNED COMPLETION TIME , CHANGE STATUS TO oVERDUE  -- THIS IS IN CRON
-list of tasks for a user is failing
-in fms master - step id there which is being generated from front end , while updating the steps , this mighrt change , so update that as well
-ADD DAYS LOGIC AS WELL IN BOTH THE TASK TRIGGERING FOR STEP 1 AND TASK UPDATION
-add an api to fetch dueToday tasks and all overdue tasks for that employee get request
-once the fmsQA is submitted in the fms Master add one more firld called live fms's and increment that valur - later once all steps for that qa is completed decrement this value 
-for manage fms - admin and pc 
-for a pc which all fms they are port of and all the overdue tasks for all these fms 
-all over overdue tasks irrespective of process or fms
-just all the fms overdue tasks and then fms that a user_id who is the PC is associated with 
-in update fms task api while submitting , when fetching the next taask , if there is no next task mark that fmsqaId AS COMPLETED(add the fmsqa key there)
-make an api where if I pass you fmsmasterid & stepid, can you give me list of previous stepids and what has to be done in an array
-if stepType is "QUALITY" then in update task api, am also sending
    qualityStatus - Yes or No
    qualityScore - number
    if qualityStatus is No then , also passing
    3.1. qualityRedoSteps - array of stepId (stepId which is the lowest needs to be retriggered)
    3.2. scrapStatus - true or false (if true, then that fmsQAId needs to stop right there in that step, should not trigger any new task from any other steps)
-for a master id , tou want ana array of objects , with hall qa id and all tasks for qa id
--/findAllFmsOverdueTasksForPc
--for every task add one more field if it is on time or delayed after apdating that task , if it is delayed add one omre field to calculate the delay
--in every single fms, we need to calculate 4 data points
    Total number of tasks those are pending
    Total number of tasks those are overdue
    Percentage of Overdue tasks - [ number of overdue tasks/ (number of overdue + number of pending) ]
    Percentage of delayed tasks - [ number of delayed tasks / number of completed tasks ]
-deploy latest frontend , give KT to developers and Testers 
-change task plannedCompletionTime , taskCreationTime to IST in fmsTasks
-fix backend deployment in AWS including reading .env for both Microservices
-in fms collection change fmsMasterID to fmsMasterId -- to keep it 100% Uniform
-add proper request payloads to all API's in Postman Collection
-THIS IS HUGE -- ADD QALITY RELATED API AND VALIDATION AND LOGIC
-if task goes beyong planned date/time, status is not changing to OVERDUE. 

--previos task info api send the task id aswell in response , 
--if it is no {}
--if scrape is true -- do not create any more task 
--taskcreationTimeis changed to IST , plannedCompletionTime change that as well to IST -- ADD LOGICS FOR DAYS , VALIDATION FOR HOLIDAYS
--add step Id for previousStepDetails 


--calculate proper plannedcompletion time
--tat in days 

<60 mins 
<

-infmsSteps change plannedDate name to plannedTime
-change timeHrs to duration - variable name
in 
-in fmsTASKS - taskCreatedTime is wrong 


sumission of form --> fmsTaskCreatedTime

for hrs --> 2 conditions --> INSIDE || OUTSIDE
if(INSIDE) {
    if(taskCreatedTime + duration < thatDaysendTime) {
        plannedEndTime = 
    }
}

// AIM is to Calculate plannedCompletionTime
if durationType is "hrs" -> fetch even "working" which will be either "INSIDE" or "OUTSIDE"
if durationType is "days" -> working is manually set to null

formula to calculate planned end time
 available info - taskCreatedTime
 add either "days" or "hrs" to taskCreatedTime

 --logic for updating a task 
    check if 

-while updating a task , when checking if there exists a next task , if there is no next task (which means it is end of that flow ) update in fms for that fmsQAId as false , and change no noOfLive in fmsMaster (decrease by one) 
-in previous step detials ad step id for this API /findPreviousStepsDetails

------------------------------
add the decision score to all the tasks while creating and add the score while updating the decision task
remove all things related to quality as it is not being used -- including the api route and the field in all task documents specially while task creation
in create p-p function last 4 linessee if change is required  -- "TEST PP FUNCTION"
in submit fms questionare , standardise creating the first step


/////////////////////////////////////////////////////
akashdev@gmail.com
919513311033

akash@gmail.com - secondary contact  
919513311031

akashdeveloper@gmail.com
919513311032

salmand@gmail.com  -pc
9513311034
////////////////////////////////////////////////////


1) - make noOfFms Live is true/false
2) make waisLive is true/false
4) end step front end state does not get updated initially



















