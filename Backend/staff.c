#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <ctype.h>

#define MAX_STAFFS 100
#define DATE_TIME_FORMAT "%Y-%m-%d %H:%M:%S"

typedef struct {
    char name[50];
    float wage;
    time_t check_in_time;
    time_t check_out_time;
} Staff;

Staff min_heap[MAX_STAFFS];
Staff max_heap[MAX_STAFFS];
int min_heap_size = 0, max_heap_size = 0;

// Windows-compatible replacement for strptime
int parse_time(const char *time_str, struct tm *tm) {
    return sscanf(time_str, "%d-%d-%d %d:%d:%d",
                 &tm->tm_year, &tm->tm_mon, &tm->tm_mday,
                 &tm->tm_hour, &tm->tm_min, &tm->tm_sec) == 6;
}

void trim_newline(char *str) {
    int len = strlen(str);
    if (len > 0 && str[len-1] == '\n') {
        str[len-1] = '\0';
    }
}

void swap(Staff *a, Staff *b) {
    Staff temp = *a;
    *a = *b;
    *b = temp;
}

void heapify_min(int index) {
    int left = 2 * index + 1;
    int right = 2 * index + 2;
    int smallest = index;
    
    if (left < min_heap_size && min_heap[left].check_in_time < min_heap[smallest].check_in_time)
        smallest = left;
    if (right < min_heap_size && min_heap[right].check_in_time < min_heap[smallest].check_in_time)
        smallest = right;
    if (smallest != index) {
        swap(&min_heap[index], &min_heap[smallest]);
        heapify_min(smallest);
    }
}

void insert_min_heap(Staff staff) {
    if (min_heap_size >= MAX_STAFFS) return;
    
    int i = min_heap_size++;
    min_heap[i] = staff;
    
    while (i > 0 && min_heap[(i - 1) / 2].check_in_time > min_heap[i].check_in_time) {
        swap(&min_heap[i], &min_heap[(i - 1) / 2]);
        i = (i - 1) / 2;
    }
}

Staff extract_min_heap() {
    if (min_heap_size <= 0) {
        Staff empty = {0};
        return empty;
    }
    
    Staff root = min_heap[0];
    min_heap[0] = min_heap[--min_heap_size];
    heapify_min(0);
    return root;
}

void heapify_max(int index) {
    int left = 2 * index + 1;
    int right = 2 * index + 2;
    int largest = index;
    
    if (left < max_heap_size && max_heap[left].check_out_time > max_heap[largest].check_out_time)
        largest = left;
    if (right < max_heap_size && max_heap[right].check_out_time > max_heap[largest].check_out_time)
        largest = right;
    if (largest != index) {
        swap(&max_heap[index], &max_heap[largest]);
        heapify_max(largest);
    }
}

void insert_max_heap(Staff staff) {
    if (max_heap_size >= MAX_STAFFS) return;
    
    int i = max_heap_size++;
    max_heap[i] = staff;
    
    while (i > 0 && max_heap[(i - 1) / 2].check_out_time < max_heap[i].check_out_time) {
        swap(&max_heap[i], &max_heap[(i - 1) / 2]);
        i = (i - 1) / 2;
    }
}

void format_time(time_t t, char *buffer) {
    if (t == 0) {
        strcpy(buffer, "Not checked out");
        return;
    }
    
    struct tm *tm_info = localtime(&t);
    strftime(buffer, 20, DATE_TIME_FORMAT, tm_info);
}

int is_same_day(time_t t1, time_t t2) {
    struct tm tm1 = *localtime(&t1);
    struct tm tm2 = *localtime(&t2);
    return (tm1.tm_year == tm2.tm_year && 
            tm1.tm_mon == tm2.tm_mon && 
            tm1.tm_mday == tm2.tm_mday);
}

void save_to_csv(Staff staff, int is_check_out) {
    FILE *f = fopen("attendance.csv", is_check_out ? "r+" : "a");
    if (!f) {
        printf("Error opening attendance file\n");
        return;
    }

    if (is_check_out) {
        FILE *temp = fopen("temp.csv", "w");
        if (!temp) {
            fclose(f);
            printf("Error creating temporary file\n");
            return;
        }

        char line[300];
        int updated = 0;
        char check_in_str[20], check_out_str[20];
        format_time(staff.check_in_time, check_in_str);
        format_time(staff.check_out_time, check_out_str);

        while (fgets(line, sizeof(line), f)) {
            char name[50];
            float wage;
            char existing_check_in[20], existing_check_out[20];
            
            if (sscanf(line, "%[^,],%f,%[^,],%[^,\n]", 
                       name, &wage, existing_check_in, existing_check_out) == 4) {
                if (strcmp(name, staff.name) == 0 && 
                    strcmp(existing_check_out, "Not checked out") == 0) {
                    fprintf(temp, "%s,%.2f,%s,%s\n", 
                            staff.name, staff.wage, check_in_str, check_out_str);
                    updated = 1;
                } else {
                    fputs(line, temp);
                }
            }
        }

        if (!updated) {
            fprintf(temp, "%s,%.2f,%s,%s\n", 
                    staff.name, staff.wage, check_in_str, check_out_str);
        }

        fclose(f);
        fclose(temp);
        remove("attendance.csv");
        rename("temp.csv", "attendance.csv");
    } else {
        char check_in_str[20];
        format_time(staff.check_in_time, check_in_str);
        fprintf(f, "%s,%.2f,%s,Not checked out\n", 
                staff.name, staff.wage, check_in_str);
        fclose(f);
    }
}

void check_in() {
    Staff s = {0};
    printf("Enter Staff Name: ");
    scanf(" %49[^\n]", s.name);
    printf("Enter Wage per Hour: ");
    scanf("%f", &s.wage);
    s.check_in_time = time(NULL);
    
    insert_min_heap(s);
    save_to_csv(s, 0);
    
    char time_str[20];
    format_time(s.check_in_time, time_str);
    printf("\n  %s checked in at %s\n", s.name, time_str);
}

void check_out() {
    char search_name[50];
    printf("Enter Staff Name to Check Out: ");
    scanf(" %49[^\n]", search_name);

    FILE *f = fopen("attendance.csv", "r");
    if (!f) {
        printf("No attendance records found\n");
        return;
    }

    char line[300];
    int found = 0;
    Staff staff = {0};
    
    while (fgets(line, sizeof(line), f)) {
        char check_out_status[20];
        if (sscanf(line, "%[^,],%f,%*[^,],%19[^\n]", 
                   staff.name, &staff.wage, check_out_status) == 3) {
            if (strcmp(staff.name, search_name) == 0 && 
                strcmp(check_out_status, "Not checked out") == 0) {
                found = 1;
                break;
            }
        }
    }
    fclose(f);

    if (!found) {
        printf("\n  No matching staff found or already checked out.\n");
        return;
    }

    f = fopen("attendance.csv", "r");
    while (fgets(line, sizeof(line), f)) {
        if (strstr(line, search_name)) {
            char check_in_str[20];
            if (sscanf(line, "%*[^,],%*f,%19[^,]", check_in_str) == 1) {
                struct tm tm = {0};
                if (parse_time(check_in_str, &tm)) {
                    tm.tm_year -= 1900;
                    tm.tm_mon -= 1;
                    staff.check_in_time = mktime(&tm);
                    break;
                }
            }
        }
    }
    fclose(f);

    staff.check_out_time = time(NULL);
    double hours = difftime(staff.check_out_time, staff.check_in_time) / 3600.0;
    double salary = hours * staff.wage;
    
    insert_max_heap(staff);
    save_to_csv(staff, 1);
    
    char check_out_str[20];
    format_time(staff.check_out_time, check_out_str);
    printf("\n  %s checked out at %s\n", staff.name, check_out_str);
    printf("   Worked: %.2f hours | Earned: Rs.%.2f\n", hours, salary);
    
    FILE *log = fopen("worklogs.csv", "a");
    if (log) {
        fprintf(log, "%s,%.2f,%.2f,%s\n", 
                staff.name, staff.wage, hours, check_out_str);
        fclose(log);
    }
}

void show_present_today() {
    FILE *f = fopen("attendance.csv", "r");
    if (!f) {
        printf("\n  No attendance records found\n");
        return;
    }

    min_heap_size = 0;
    time_t today = time(NULL);
    char line[300];
    int count = 0;

    printf("\nStaff Present Today:\n");
    printf("=================================================\n");
    printf("%-20s %-10s %-20s %-20s\n", "Name", "Wage", "Check-In", "Check-Out");
    printf("-------------------------------------------------\n");

    while (fgets(line, sizeof(line), f)) {
        Staff s = {0};
        char check_in_str[20], check_out_str[20];
        
        if (sscanf(line, "%[^,],%f,%[^,],%19[^\n]", 
                   s.name, &s.wage, check_in_str, check_out_str) == 4) {
            struct tm tm = {0};
            if (parse_time(check_in_str, &tm)) {
                tm.tm_year -= 1900;
                tm.tm_mon -= 1;
                s.check_in_time = mktime(&tm);
                
                if (is_same_day(s.check_in_time, today)) {
                    if (strcmp(check_out_str, "Not checked out") != 0) {
                        if (parse_time(check_out_str, &tm)) {
                            tm.tm_year -= 1900;
                            tm.tm_mon -= 1;
                            s.check_out_time = mktime(&tm);
                        }
                    }
                    
                    char in_time[20], out_time[20];
                    format_time(s.check_in_time, in_time);
                    format_time(s.check_out_time, out_time);
                    
                    printf("%-20s Rs.%-9.2f %-20s %-20s\n", 
                           s.name, s.wage, in_time, out_time);
                    count++;
                    
                    insert_min_heap(s);
                }
            }
        }
    }
    fclose(f);

    if (count == 0) {
        printf("No staff present today\n");
    }
    printf("=================================================\n");
}

void search_staff() {
    char name[50];
    printf("Enter Staff Name to Search: ");
    scanf(" %49[^\n]", name);

    FILE *f = fopen("attendance.csv", "r");
    if (!f) {
        printf("  No attendance records found\n");
        return;
    }

    char line[300];
    int found = 0;

    printf("\nSearch Results:\n");
    printf("=================================================\n");
    printf("%-20s %-10s %-20s %-20s\n", "Name", "Wage", "Check-In", "Check-Out");
    printf("-------------------------------------------------\n");

    while (fgets(line, sizeof(line), f)) {
        Staff s = {0};
        char check_in_str[20], check_out_str[20];
        
        if (sscanf(line, "%[^,],%f,%[^,],%19[^\n]", 
                   s.name, &s.wage, check_in_str, check_out_str) == 4) {
            if (strstr(s.name, name)) {
                struct tm tm = {0};
                if (parse_time(check_in_str, &tm)) {
                    tm.tm_year -= 1900;
                    tm.tm_mon -= 1;
                    s.check_in_time = mktime(&tm);
                    
                    if (strcmp(check_out_str, "Not checked out") != 0) {
                        if (parse_time(check_out_str, &tm)) {
                            tm.tm_year -= 1900;
                            tm.tm_mon -= 1;
                            s.check_out_time = mktime(&tm);
                        }
                    }
                    
                    char in_time[20], out_time[20];
                    format_time(s.check_in_time, in_time);
                    format_time(s.check_out_time, out_time);
                    
                    printf("%-20s Rs.%-9.2f %-20s %-20s\n", 
                           s.name, s.wage, in_time, out_time);
                    found = 1;
                }
            }
        }
    }
    fclose(f);

    if (!found) {
        printf("No records found for '%s'\n", name);
    }
    printf("=================================================\n");
}

void edit_staff() {
    char name[50];
    float new_wage;
    printf("Enter Staff Name to Edit: ");
    scanf(" %49[^\n]", name);
    printf("Enter New Wage: ");
    scanf("%f", &new_wage);

    FILE *f = fopen("attendance.csv", "r");
    FILE *temp = fopen("temp.csv", "w");
    if (!f || !temp) {
        printf(" Error opening files\n");
        return;
    }

    char line[300];
    int updated = 0;

    while (fgets(line, sizeof(line), f)) {
        Staff s = {0};
        char check_in_str[20], check_out_str[20];
        
        if (sscanf(line, "%[^,],%f,%[^,],%19[^\n]", 
                   s.name, &s.wage, check_in_str, check_out_str) == 4) {
            if (strcmp(s.name, name) == 0) {
                fprintf(temp, "%s,%.2f,%s,%s\n", 
                       name, new_wage, check_in_str, check_out_str);
                updated = 1;
            } else {
                fputs(line, temp);
            }
        }
    }

    fclose(f);
    fclose(temp);

    if (updated) {
        remove("attendance.csv");
        rename("temp.csv", "attendance.csv");
        printf("  Wage updated for %s\n", name);
    } else {
        remove("temp.csv");
        printf("  Staff not found\n");
    }
}

void delete_staff() {
    char name[50];
    printf("Enter Staff Name to Delete: ");
    scanf(" %49[^\n]", name);

    FILE *f = fopen("attendance.csv", "r");
    FILE *temp = fopen("temp.csv", "w");
    if (!f || !temp) {
        printf("  Error opening files\n");
        return;
    }

    char line[300];
    int deleted = 0;

    while (fgets(line, sizeof(line), f)) {
        char current_name[50];
        if (sscanf(line, "%[^,]", current_name) == 1) {
            if (strcmp(current_name, name) != 0) {
                fputs(line, temp);
            } else {
                deleted = 1;
            }
        }
    }

    fclose(f);
    fclose(temp);

    if (deleted) {
        remove("attendance.csv");
        rename("temp.csv", "attendance.csv");
        printf("  Staff %s deleted successfully\n", name);
    } else {
        remove("temp.csv");
        printf("  Staff not found\n");
    }
}

int main() {
    int choice;
    while (1) {
        printf("\n========= Staff Management System =========\n");
        printf("1. Check-in Staff\n");
        printf("2. Check-out Staff\n");
        printf("3. Show Today's Attendance\n");
        printf("4. Search Staff\n");
        printf("5. Edit Staff Wage\n");
        printf("6. Delete Staff\n");
        printf("7. Exit\n");
        printf("==========================================\n");
        printf("Enter your choice: ");
        
        if (scanf("%d", &choice) != 1) {
            printf("Invalid input. Please enter a number.\n");
            while (getchar() != '\n');
            continue;
        }

        switch (choice) {
            case 1: check_in(); break;
            case 2: check_out(); break;
            case 3: show_present_today(); break;
            case 4: search_staff(); break;
            case 5: edit_staff(); break;
            case 6: delete_staff(); break;
            case 7: return 0;
            default: printf("  Invalid choice. Try again.\n");
        }
    }
}
