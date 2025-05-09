#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <errno.h>
#include <ctype.h>
#include <stdbool.h>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

#define CSV_FILE "../server/data/residents.csv"
#define MAX_LINE_LENGTH 1024

typedef enum { OWNER, TENANT } OwnershipStatus;
typedef enum { PAID, UNPAID, PARTIAL } MaintenanceStatus;

typedef struct Resident {
    char name[50];
    char door_number[50];
    char contact[11];
    OwnershipStatus ownership_status;
    char parking_slot[10];
    MaintenanceStatus maintenance_status;
    struct Resident* left;
    struct Resident* right;
} Resident;

typedef struct Floor {
    int floor_number;
    Resident* resident_tree;
    struct Floor* next;
} Floor;

typedef struct Block {
    char block_name[20];
    Floor* floor_list;
    struct Block* next;
} Block;

typedef struct {
    Block* block_list;
} ResidentManagementSystem;

// Function prototypes
Resident* create_resident(const char* name, const char* door_num, const char* contact, 
                         OwnershipStatus own_status, const char* parking, 
                         MaintenanceStatus maint_status);
Resident* insert_resident(Resident* root, Resident* new_resident);
bool resident_exists(Resident* root, const char* door_num);
Resident* find_resident_recursive(Resident* root, const char* door_num);
Resident* delete_resident_recursive(Resident* root, const char* door_num);
Resident* find_min_resident(Resident* root);
void print_resident_json(Resident* resident, const char* block_name, int floor_number);
void print_resident_tree_json(Resident* root, const char* block_name, int floor_number, int* first);
void print_all_residents_json(ResidentManagementSystem* rms);
void handle_search_command(ResidentManagementSystem* rms, int argc, char *argv[]);
void search_by_phone_json(ResidentManagementSystem* rms, const char* phone, int* first_result);
void search_by_name_json(ResidentManagementSystem* rms, const char* name, int* first_result);
void search_unpaid_json(ResidentManagementSystem* rms, int* first_result);
void search_by_block_json(ResidentManagementSystem* rms, const char* block_name, int* first_result);
void search_by_floor_json(ResidentManagementSystem* rms, int floor_number, int* first_result);
bool validate_name(const char* name);
bool validate_contact(const char* contact);
bool validate_door_number(const char* door_num, const char* block_name, int floor);
bool validate_block_name(const char* block_name);
bool validate_floor_number(int floor);
void add_resident(ResidentManagementSystem* rms, const char* name, const char* block_name, 
                 int floor_number, const char* door_alpha, const char* contact, 
                 OwnershipStatus own_status, const char* parking, 
                 MaintenanceStatus maint_status);
void delete_resident(ResidentManagementSystem* rms, const char* door_num);
Block* find_block_recursive(Block* current, const char* block_name);
Floor* find_floor_recursive(Floor* current, int floor_number);
void free_resident_tree(Resident* root);
void free_floor_list(Floor* floor);
void free_block_list(Block* block);
void cleanup_system(ResidentManagementSystem* rms);
void save_to_csv(ResidentManagementSystem* rms);
void load_from_csv(ResidentManagementSystem* rms);
void write_residents_to_file(FILE* file, Resident* root, const char* block_name, int floor_number);
const char* ownership_to_str(OwnershipStatus status);
const char* maintenance_to_str(MaintenanceStatus status);
OwnershipStatus str_to_ownership(const char* str);
MaintenanceStatus str_to_maintenance(const char* str);

// Initialize empty system
ResidentManagementSystem* initialize_system() {
    ResidentManagementSystem* rms = malloc(sizeof(ResidentManagementSystem));
    if (!rms) return NULL;
    rms->block_list = NULL;
    return rms;
}

// Create new resident with validation
Resident* create_resident(const char* name, const char* door_num, const char* contact, 
                         OwnershipStatus own_status, const char* parking, 
                         MaintenanceStatus maint_status) {
    Resident* new_resident = malloc(sizeof(Resident));
    if (!new_resident) return NULL;

    strncpy(new_resident->name, name, sizeof(new_resident->name) - 1);
    new_resident->name[sizeof(new_resident->name) - 1] = '\0';
    strncpy(new_resident->door_number, door_num, sizeof(new_resident->door_number) - 1);
    new_resident->door_number[sizeof(new_resident->door_number) - 1] = '\0';
    strncpy(new_resident->contact, contact, sizeof(new_resident->contact) - 1);
    new_resident->contact[sizeof(new_resident->contact) - 1] = '\0';
    new_resident->ownership_status = own_status;
    strncpy(new_resident->parking_slot, parking, sizeof(new_resident->parking_slot) - 1);
    new_resident->parking_slot[sizeof(new_resident->parking_slot) - 1] = '\0';
    new_resident->maintenance_status = maint_status;
    new_resident->left = NULL;
    new_resident->right = NULL;

    return new_resident;
}

// Insert resident into BST
Resident* insert_resident(Resident* root, Resident* new_resident) {
    if (!root) return new_resident;

    if (strcmp(new_resident->door_number, root->door_number) < 0) {
        root->left = insert_resident(root->left, new_resident);
    } else if (strcmp(new_resident->door_number, root->door_number) > 0) {
        root->right = insert_resident(root->right, new_resident);
    }

    return root;
}

// Check if resident exists in tree
bool resident_exists(Resident* root, const char* door_num) {
    if (!root) return false;
    if (strcmp(door_num, root->door_number) == 0) return true;
    if (strcmp(door_num, root->door_number) < 0) return resident_exists(root->left, door_num);
    return resident_exists(root->right, door_num);
}

// Find resident recursively
Resident* find_resident_recursive(Resident* root, const char* door_num) {
    if (!root) return NULL;
    if (strcmp(door_num, root->door_number) == 0) return root;
    if (strcmp(door_num, root->door_number) < 0) return find_resident_recursive(root->left, door_num);
    return find_resident_recursive(root->right, door_num);
}

// Find minimum value resident in a subtree
Resident* find_min_resident(Resident* root) {
    if (!root) return NULL;
    if (!root->left) return root;
    return find_min_resident(root->left);
}

// Delete resident recursively
Resident* delete_resident_recursive(Resident* root, const char* door_num) {
    if (!root) return NULL;

    if (strcmp(door_num, root->door_number) < 0) {
        root->left = delete_resident_recursive(root->left, door_num);
    } else if (strcmp(door_num, root->door_number) > 0) {
        root->right = delete_resident_recursive(root->right, door_num);
    } else {
        // Resident found - delete it
        if (!root->left) {
            Resident* temp = root->right;
            free(root);
            return temp;
        } else if (!root->right) {
            Resident* temp = root->left;
            free(root);
            return temp;
        }

        // Node with two children
        Resident* temp = find_min_resident(root->right);
        strcpy(root->door_number, temp->door_number);
        strcpy(root->name, temp->name);
        strcpy(root->contact, temp->contact);
        root->ownership_status = temp->ownership_status;
        strcpy(root->parking_slot, temp->parking_slot);
        root->maintenance_status = temp->maintenance_status;
        root->right = delete_resident_recursive(root->right, temp->door_number);
    }
    return root;
}

// Print resident as JSON
void print_resident_json(Resident* resident, const char* block_name, int floor_number) {
    printf("{\"name\":\"%s\",\"door_number\":\"%s\",\"contact\":\"%s\","
           "\"ownership\":\"%s\",\"parking_slot\":\"%s\",\"maintenance\":\"%s\","
           "\"block\":\"%s\",\"floor\":%d}",
           resident->name, resident->door_number, resident->contact,
           ownership_to_str(resident->ownership_status), resident->parking_slot,
           maintenance_to_str(resident->maintenance_status),
           block_name, floor_number);
}

// Print resident tree as JSON array elements
void print_resident_tree_json(Resident* root, const char* block_name, int floor_number, int* first) {
    if (!root) return;
    
    print_resident_tree_json(root->left, block_name, floor_number, first);
    
    if (!*first) {
        printf(",");
    } else {
        *first = 0;
    }
    
    print_resident_json(root, block_name, floor_number);
    
    print_resident_tree_json(root->right, block_name, floor_number, first);
}

// Print all residents as JSON array
void print_all_residents_json(ResidentManagementSystem* rms) {
    printf("[");
    Block* block = rms->block_list;
    int first_block = 1;
    
    while (block) {
        Floor* floor = block->floor_list;
        while (floor) {
            print_resident_tree_json(floor->resident_tree, block->block_name, floor->floor_number, &first_block);
            floor = floor->next;
        }
        block = block->next;
    }
    printf("]");
}
// Handle search commands from the web interface
void handle_search_command(ResidentManagementSystem* rms, int argc, char *argv[]) {
    printf("[");
    int first_result = 1;
    
    if (strcmp(argv[2], "door") == 0 && argc == 4) {
        // Search by door number
        Block* block = rms->block_list;
        while (block) {
            Floor* floor = block->floor_list;
            while (floor) {
                Resident* resident = find_resident_recursive(floor->resident_tree, argv[3]);
                if (resident) {
                    if (!first_result) printf(",");
                    first_result = 0;
                    print_resident_json(resident, block->block_name, floor->floor_number);
                }
                floor = floor->next;
            }
            block = block->next;
        }
    }
    else if (strcmp(argv[2], "phone") == 0 && argc == 4) {
        // Search by phone
        search_by_phone_json(rms, argv[3], &first_result);
    }
    else if (strcmp(argv[2], "name") == 0 && argc == 4) {
        // Search by name
        search_by_name_json(rms, argv[3], &first_result);
    }
    else if (strcmp(argv[2], "unpaid") == 0) {
        // Search unpaid maintenance
        search_unpaid_json(rms, &first_result);
    }
    else if (strcmp(argv[2], "block") == 0 && argc == 4) {
        // Search by block
        search_by_block_json(rms, argv[3], &first_result);
    }
    else if (strcmp(argv[2], "floor") == 0 && argc == 4) {
        // Search by floor
        search_by_floor_json(rms, atoi(argv[3]), &first_result);
    }
    
    printf("]");
}

// Search by phone number (JSON output)
void search_by_phone_json(ResidentManagementSystem* rms, const char* phone, int* first_result) {
    Block* block = rms->block_list;
    
    while (block) {
        Floor* floor = block->floor_list;
        while (floor) {
            Resident* current = floor->resident_tree;
            Resident* stack[100];
            int top = -1;
            
            while (1) {
                while (current) {
                    stack[++top] = current;
                    current = current->left;
                }
                
                if (top == -1) break;
                
                current = stack[top--];
                
                if (strcmp(current->contact, phone) == 0) {
                    if (!*first_result) printf(",");
                    *first_result = 0;
                    print_resident_json(current, block->block_name, floor->floor_number);
                }
                
                current = current->right;
            }
            floor = floor->next;
        }
        block = block->next;
    }
}

// Case-insensitive string search helper
const char* case_insensitive_strstr(const char* haystack, const char* needle) {
    if (!*needle) return haystack;
    
    for (; *haystack; haystack++) {
        if (tolower(*haystack) == tolower(*needle)) {
            const char *h = haystack, *n = needle;
            while (*h && *n && tolower(*h) == tolower(*n)) {
                h++;
                n++;
            }
            if (!*n) return haystack;
        }
    }
    return NULL;
}

// Search by name (JSON output)
void search_by_name_json(ResidentManagementSystem* rms, const char* name, int* first_result) {
    Block* block = rms->block_list;
    
    while (block) {
        Floor* floor = block->floor_list;
        while (floor) {
            Resident* current = floor->resident_tree;
            Resident* stack[100];
            int top = -1;
            
            while (1) {
                while (current) {
                    stack[++top] = current;
                    current = current->left;
                }
                
                if (top == -1) break;
                
                current = stack[top--];
                
                if (case_insensitive_strstr(current->name, name) != NULL) {
                    if (!*first_result) printf(",");
                    *first_result = 0;
                    print_resident_json(current, block->block_name, floor->floor_number);
                }
                
                current = current->right;
            }
            floor = floor->next;
        }
        block = block->next;
    }
}

// Search unpaid maintenance (JSON output)
void search_unpaid_json(ResidentManagementSystem* rms, int* first_result) {
    Block* block = rms->block_list;
    
    while (block) {
        Floor* floor = block->floor_list;
        while (floor) {
            Resident* current = floor->resident_tree;
            Resident* stack[100];
            int top = -1;
            
            while (1) {
                while (current) {
                    stack[++top] = current;
                    current = current->left;
                }
                
                if (top == -1) break;
                
                current = stack[top--];
                
                if (current->maintenance_status == UNPAID || 
                    current->maintenance_status == PARTIAL) {
                    if (!*first_result) printf(",");
                    *first_result = 0;
                    print_resident_json(current, block->block_name, floor->floor_number);
                }
                
                current = current->right;
            }
            floor = floor->next;
        }
        block = block->next;
    }
}

// Search by block (JSON output)
void search_by_block_json(ResidentManagementSystem* rms, const char* block_name, int* first_result) {
    Block* block = find_block_recursive(rms->block_list, block_name);
    
    if (!block) return;
    
    Floor* floor = block->floor_list;
    while (floor) {
        Resident* current = floor->resident_tree;
        Resident* stack[100];
        int top = -1;
        
        while (1) {
            while (current) {
                stack[++top] = current;
                current = current->left;
            }
            
            if (top == -1) break;
            
            current = stack[top--];
            
            if (!*first_result) printf(",");
            *first_result = 0;
            print_resident_json(current, block->block_name, floor->floor_number);
            
            current = current->right;
        }
        floor = floor->next;
    }
}

// Search by floor (JSON output)
void search_by_floor_json(ResidentManagementSystem* rms, int floor_number, int* first_result) {
    Block* block = rms->block_list;
    
    while (block) {
        Floor* floor = find_floor_recursive(block->floor_list, floor_number);
        if (floor) {
            Resident* current = floor->resident_tree;
            Resident* stack[100];
            int top = -1;
            
            while (1) {
                while (current) {
                    stack[++top] = current;
                    current = current->left;
                }
                
                if (top == -1) break;
                
                current = stack[top--];
                
                if (!*first_result) printf(",");
                *first_result = 0;
                print_resident_json(current, block->block_name, floor->floor_number);
                
                current = current->right;
            }
        }
        block = block->next;
    }
}

// [Keep all your existing validation functions...]

// Add new block
void add_block(ResidentManagementSystem* rms, const char* block_name) {
    Block* new_block = malloc(sizeof(Block));
    if (!new_block) return;

    strncpy(new_block->block_name, block_name, sizeof(new_block->block_name) - 1);
    new_block->block_name[sizeof(new_block->block_name) - 1] = '\0';
    new_block->floor_list = NULL;
    new_block->next = rms->block_list;
    rms->block_list = new_block;
}

// Add new floor
void add_floor(ResidentManagementSystem* rms, const char* block_name, int floor_number) {
    Block* block = find_block_recursive(rms->block_list, block_name);
    if (!block) {
        add_block(rms, block_name);
        block = find_block_recursive(rms->block_list, block_name);
    }

    Floor* new_floor = malloc(sizeof(Floor));
    if (!new_floor) return;

    new_floor->floor_number = floor_number;
    new_floor->resident_tree = NULL;
    new_floor->next = block->floor_list;
    block->floor_list = new_floor;
}

// Add resident with validation
void add_resident(ResidentManagementSystem* rms, const char* name, const char* block_name, 
                 int floor_number, const char* door_alpha, const char* contact, 
                 OwnershipStatus own_status, const char* parking, 
                 MaintenanceStatus maint_status) {
    // Construct full door number
    char door_num[50];
    sprintf(door_num, "%s-%d-%s", block_name, floor_number, door_alpha);

    Block* block = find_block_recursive(rms->block_list, block_name);
    if (!block) {
        add_block(rms, block_name);
        block = find_block_recursive(rms->block_list, block_name);
    }

    Floor* floor = find_floor_recursive(block->floor_list, floor_number);
    if (!floor) {
        add_floor(rms, block_name, floor_number);
        floor = find_floor_recursive(block->floor_list, floor_number);
    }

    // Check if door number exists
    if (resident_exists(floor->resident_tree, door_num)) {
        printf("{\"status\":\"error\",\"message\":\"Door number already exists\"}");
        return;
    }

    Resident* new_resident = create_resident(name, door_num, contact, own_status, parking, maint_status);
    if (!new_resident) {
        printf("{\"status\":\"error\",\"message\":\"Memory allocation failed\"}");
        return;
    }

    floor->resident_tree = insert_resident(floor->resident_tree, new_resident);
}

// Delete resident
void delete_resident(ResidentManagementSystem* rms, const char* door_num) {
    Block* block = rms->block_list;
    
    while (block) {
        Floor* floor = block->floor_list;
        while (floor) {
            if (resident_exists(floor->resident_tree, door_num)) {
                floor->resident_tree = delete_resident_recursive(floor->resident_tree, door_num);
                return;
            }
            floor = floor->next;
        }
        block = block->next;
    }
    
    printf("{\"status\":\"error\",\"message\":\"Resident not found\"}");
}
// Convert ownership status to string
const char* ownership_to_str(OwnershipStatus status) {
    switch (status) {
        case OWNER: return "OWNER";
        case TENANT: return "TENANT";
        default: return "UNKNOWN";
    }
}

// Convert maintenance status to string
const char* maintenance_to_str(MaintenanceStatus status) {
    switch (status) {
        case PAID: return "PAID";
        case UNPAID: return "UNPAID";
        case PARTIAL: return "PARTIAL";
        default: return "UNKNOWN";
    }
}

// Find block recursively
Block* find_block_recursive(Block* current, const char* block_name) {
    if (!current) return NULL;
    if (strcmp(current->block_name, block_name) == 0) return current;
    return find_block_recursive(current->next, block_name);
}

// Find floor recursively
Floor* find_floor_recursive(Floor* current, int floor_number) {
    if (!current) return NULL;
    if (current->floor_number == floor_number) return current;
    return find_floor_recursive(current->next, floor_number);
}

// Free resident tree memory
void free_resident_tree(Resident* root) {
    if (!root) return;
    free_resident_tree(root->left);
    free_resident_tree(root->right);
    free(root);
}

// Free floor list memory
void free_floor_list(Floor* floor) {
    if (!floor) return;
    free_floor_list(floor->next);
    free_resident_tree(floor->resident_tree);
    free(floor);
}

// Free block list memory
void free_block_list(Block* block) {
    if (!block) return;
    free_block_list(block->next);
    free_floor_list(block->floor_list);
    free(block);
}

// Clean up the entire system
void cleanup_system(ResidentManagementSystem* rms) {
    if (!rms) return;
    free_block_list(rms->block_list);
    free(rms);
}

// Save data to CSV file
void save_to_csv(ResidentManagementSystem* rms) {
    FILE* file = fopen(CSV_FILE, "w");
    if (!file) {
        perror("Error opening CSV file for writing");
        return;
    }

    // Write header
    fprintf(file, "Name,Door Number,Contact,Ownership Status,Parking Slot,Maintenance Status,Block,Floor\n");

    Block* block = rms->block_list;
    while (block) {
        Floor* floor = block->floor_list;
        while (floor) {
            write_residents_to_file(file, floor->resident_tree, block->block_name, floor->floor_number);
            floor = floor->next;
        }
        block = block->next;
    }

    fclose(file);
}

// Write residents to file
void write_residents_to_file(FILE* file, Resident* root, const char* block_name, int floor_number) {
    if (!root) return;

    write_residents_to_file(file, root->left, block_name, floor_number);
    
    fprintf(file, "\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%d\n",
            root->name, root->door_number, root->contact,
            ownership_to_str(root->ownership_status), root->parking_slot,
            maintenance_to_str(root->maintenance_status),
            block_name, floor_number);
    
    write_residents_to_file(file, root->right, block_name, floor_number);
}

// Load data from CSV file
void load_from_csv(ResidentManagementSystem* rms) {
    FILE* file = fopen(CSV_FILE, "r");
    if (!file) {
        // File doesn't exist yet, that's okay
        return;
    }

    char line[MAX_LINE_LENGTH];
    // Skip header line
    fgets(line, sizeof(line), file);

    while (fgets(line, sizeof(line), file)) {
        // Remove newline character
        line[strcspn(line, "\n")] = '\0';

        char* token;
        char* tokens[8];
        int i = 0;

        // Parse CSV line (handling quoted fields)
        token = strtok(line, ",");
        while (token != NULL && i < 8) {
            // Remove surrounding quotes if present
            if (token[0] == '"' && token[strlen(token)-1] == '"') {
                token[strlen(token)-1] = '\0';
                token++;
            }
            tokens[i++] = token;
            token = strtok(NULL, ",");
        }

        if (i == 8) {
            // Parse the fields
            char* name = tokens[0];
            char* door_number = tokens[1];
            char* contact = tokens[2];
            OwnershipStatus own_status = str_to_ownership(tokens[3]);
            char* parking = tokens[4];
            MaintenanceStatus maint_status = str_to_maintenance(tokens[5]);
            char* block_name = tokens[6];
            int floor_number = atoi(tokens[7]);

            // Add to system
            add_resident(rms, name, block_name, floor_number, 
                        door_number + strlen(block_name) + 3, // Extract door alpha part
                        contact, own_status, parking, maint_status);
        }
    }

    fclose(file);
}

// Convert string to ownership status
OwnershipStatus str_to_ownership(const char* str) {
    if (strcmp(str, "OWNER") == 0) return OWNER;
    if (strcmp(str, "TENANT") == 0) return TENANT;
    return OWNER; // Default
}

// Convert string to maintenance status
MaintenanceStatus str_to_maintenance(const char* str) {
    if (strcmp(str, "PAID") == 0) return PAID;
    if (strcmp(str, "UNPAID") == 0) return UNPAID;
    if (strcmp(str, "PARTIAL") == 0) return PARTIAL;
    return PAID; // Default
}

// Main function - handles commands from Node.js
int main(int argc, char *argv[]) {
    #ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY); // Set stdout to binary mode on Windows
    #endif

    ResidentManagementSystem* rms = initialize_system();
    if (!rms) {
        printf("{\"status\":\"error\",\"message\":\"Failed to initialize system\"}");
        return 1;
    }

    load_from_csv(rms);

    if (argc < 2) {
        printf("{\"status\":\"error\",\"message\":\"No command specified\"}");
        cleanup_system(rms);
        return 1;
    }

    char* command = argv[1];
    
    if (strcmp(command, "list") == 0) {
        print_all_residents_json(rms);
    }
    else if (strcmp(command, "add") == 0 && argc == 10) {
        add_resident(rms, argv[2], argv[3], atoi(argv[4]), argv[5], argv[6],
                    strcmp(argv[7], "OWNER") == 0 ? OWNER : TENANT,
                    argv[8],
                    strcmp(argv[9], "PAID") == 0 ? PAID : 
                    strcmp(argv[9], "UNPAID") == 0 ? UNPAID : PARTIAL);
        printf("{\"status\":\"success\",\"message\":\"Resident added\"}");
    }
    else if (strcmp(command, "delete") == 0 && argc == 3) {
        delete_resident(rms, argv[2]);
        printf("{\"status\":\"success\",\"message\":\"Resident deleted\"}");
    }
    else if (strcmp(command, "search") == 0 && argc >= 3) {
        handle_search_command(rms, argc, argv);
    }
    else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command or arguments\"}");
    }

    save_to_csv(rms);
    cleanup_system(rms);
    return 0;
}