#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <ctype.h>

#define TABLE_SIZE 100
#define FILE_NAME "server/data/usage_logs.csv"

typedef struct UsageLog {
    char date[11];        // YYYY-MM-DD
    char time[6];         // HH:MM
    char facility[20];
    char residentID[50];  // Mayflower-5-A
    char residentName[50];
    int duration;
    struct UsageLog* next;
} UsageLog;

typedef struct {
    UsageLog* head;
    int count;
} LogList;

LogList residentLogs[TABLE_SIZE];

// Function prototypes
void printLog(UsageLog* log);
unsigned int hash(const char* key);
UsageLog* createLog(const char* date, const char* time, const char* facility, 
                   const char* residentID, const char* residentName, int duration);
void saveLogs();
void loadLogs();
void cleanup();
void searchLogs(const char* type, const char* value);

unsigned int hash(const char* key) {
    unsigned long hash = 5381;
    int c;
    while ((c = *key++)) {
        hash = ((hash << 5) + hash) + c;
    }
    return hash % TABLE_SIZE;
}

UsageLog* createLog(const char* date, const char* time, const char* facility, 
                   const char* residentID, const char* residentName, int duration) {
    // Basic validation
    if (!date || !time || !facility || !residentID || !residentName || duration < 0) {
        return NULL;
    }

    UsageLog* newLog = (UsageLog*)malloc(sizeof(UsageLog));
    if (!newLog) return NULL;

    strncpy(newLog->date, date, 10);
    strncpy(newLog->time, time, 5);
    strncpy(newLog->facility, facility, 19);
    strncpy(newLog->residentID, residentID, 49);
    strncpy(newLog->residentName, residentName, 49);
    newLog->duration = duration;
    newLog->next = NULL;

    // Ensure null termination
    newLog->date[10] = '\0';
    newLog->time[5] = '\0';
    newLog->facility[19] = '\0';
    newLog->residentID[49] = '\0';
    newLog->residentName[49] = '\0';

    return newLog;
}

void saveLogs() {
    FILE* file = fopen(FILE_NAME, "w");
    if (!file) {
        perror("Error opening file");
        printf("{\"status\":\"error\",\"message\":\"Cannot open file for writing\"}");
        return;
    }
    
    fprintf(file, "ResidentID,ResidentName,Date,Time,Facility,Duration\n");
    
    for (int i = 0; i < TABLE_SIZE; i++) {
        UsageLog* current = residentLogs[i].head;
        while (current) {
            fprintf(file, "%s,%s,%s,%s,%s,%d\n",
                   current->residentID,
                   current->residentName,
                   current->date,
                   current->time,
                   current->facility,
                   current->duration);
            current = current->next;
        }
    }
    
    fclose(file);
}

void loadLogs() {
    FILE* file = fopen(FILE_NAME, "r");
    if (!file) return;
    
    char line[256];
    fgets(line, sizeof(line), file); // Skip header
    
    while (fgets(line, sizeof(line), file)) {
        char residentID[50], residentName[50], date[11], time[6], facility[20];
        int duration;
        
        if (sscanf(line, "%49[^,],%49[^,],%10[^,],%5[^,],%19[^,],%d",
               residentID, residentName, date, time, facility, &duration) == 6) {
            
            int index = hash(residentID);
            UsageLog* newLog = createLog(date, time, facility, residentID, residentName, duration);
            if (newLog) {
                newLog->next = residentLogs[index].head;
                residentLogs[index].head = newLog;
                residentLogs[index].count++;
            }
        }
    }
    
    fclose(file);
}

void printLog(UsageLog* log) {
    printf("{\"residentID\":\"%s\",\"residentName\":\"%s\",\"date\":\"%s\",\"time\":\"%s\",\"facility\":\"%s\",\"duration\":%d}",
           log->residentID, log->residentName, log->date, log->time, log->facility, log->duration);
}

void cleanup() {
    for (int i = 0; i < TABLE_SIZE; i++) {
        UsageLog* current = residentLogs[i].head;
        while (current) {
            UsageLog* temp = current;
            current = current->next;
            free(temp);
        }
        residentLogs[i].head = NULL;
        residentLogs[i].count = 0;
    }
}

void handleRequest(const char* command, const char* residentID, const char* residentName, 
    const char* facility, const char* date, const char* time, int duration,
    const char* searchType, const char* searchValue) {
        if (strcmp(command, "add") == 0) {
        int index = hash(residentID);
        UsageLog* newLog = createLog(date, time, facility, residentID, residentName, duration);
        if (!newLog) {
            printf("{\"status\":\"error\",\"message\":\"Invalid log data\"}");
            return;
        }
        
        newLog->next = residentLogs[index].head;
        residentLogs[index].head = newLog;
        residentLogs[index].count++;
        
        saveLogs();
        printf("{\"status\":\"success\",\"message\":\"Usage recorded successfully\"}");
    }
    else if (strcmp(command, "get") == 0) {
        printf("{\"logs\":[");
        int first = 1;
        for (int i = 0; i < TABLE_SIZE; i++) {
            UsageLog* current = residentLogs[i].head;
            while (current) {
                if (!first) printf(",");
                first = 0;
                printLog(current);
                current = current->next;
            }
        }
        printf("]}");
    }
    else if (strcmp(command, "search") == 0) {
        searchLogs(searchType, searchValue);
    }
    else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}");
    }
}
void searchLogs(const char* type, const char* value) {
    printf("{\"logs\":[");
    int first = 1;
    
    for (int i = 0; i < TABLE_SIZE; i++) {
        UsageLog* current = residentLogs[i].head;
        while (current) {
            int match = 0;
            
            if (strcmp(type, "resident") == 0 && strstr(current->residentName, value)) {
                match = 1;
            }
            else if (strcmp(type, "door") == 0 && strstr(current->residentID, value)) {
                match = 1;
            }
            else if (strcmp(type, "facility") == 0 && strstr(current->facility, value)) {
                match = 1;
            }
            else if (strcmp(type, "date") == 0 && strstr(current->date, value)) {
                match = 1;
            }
            
            if (match) {
                if (!first) printf(",");
                first = 0;
                printLog(current);
            }
            current = current->next;
        }
    }
    printf("]}");
}

int main(int argc, char* argv[]) {
    // Initialize hash tables
    for (int i = 0; i < TABLE_SIZE; i++) {
        residentLogs[i].head = NULL;
        residentLogs[i].count = 0;
    }
    
    // Load existing data
    loadLogs();
    
    if (argc < 2) {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}");
        cleanup();
        return 1;
    }
    
    const char* command = argv[1];
    
    if (strcmp(command, "add") == 0 && argc == 8) {
        // Format: add "door" "name" "facility" "date" "time" duration
        handleRequest(command, argv[2], argv[3], argv[4], argv[5], argv[6], atoi(argv[7]), "", "");
    }
    else if (strcmp(command, "get") == 0 && argc == 2) {
        // Format: get
        handleRequest(command, "", "", "", "", "", 0, "", "");
    }
    else if (strcmp(command, "search") == 0 && argc == 4) {
        // Format: search "type" "value"
        handleRequest(command, "", "", "", "", "", 0, argv[2], argv[3]);
    }
    else {
        printf("{\"status\":\"error\",\"message\":\"Invalid arguments\"}");
        cleanup();
        return 1;
    }
    
    // Clean up memory
    cleanup();
    return 0;
}