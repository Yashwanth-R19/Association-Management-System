// Residents module: Block (list) -> Floor (list) -> Resident (BST keyed by
// door number). This process is a stateless per-request compute engine now:
// it reads the current dataset as CSV on stdin, performs exactly one
// operation, and prints {"result": ..., "state": [...] } to stdout. Node
// owns persistence (Postgres) and feeds/reads this process per request; there
// is no CSV_FILE and this program never touches disk.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <ctype.h>
#include <stdbool.h>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

#define MAX_LINE_LENGTH 1024

typedef enum { OWNER, TENANT } OwnershipStatus;

typedef struct Resident {
    char name[50];
    char door_number[50];
    char contact[20];
    OwnershipStatus ownership_status;
    char parking_slot[10];
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

Block* find_block_recursive(Block* current, const char* block_name) {
    if (!current) return NULL;
    if (strcmp(current->block_name, block_name) == 0) return current;
    return find_block_recursive(current->next, block_name);
}

Floor* find_floor_recursive(Floor* current, int floor_number) {
    if (!current) return NULL;
    if (current->floor_number == floor_number) return current;
    return find_floor_recursive(current->next, floor_number);
}

Resident* create_resident(const char* name, const char* door_num, const char* contact,
                           OwnershipStatus own_status, const char* parking) {
    Resident* r = malloc(sizeof(Resident));
    if (!r) return NULL;
    strncpy(r->name, name, sizeof(r->name) - 1); r->name[sizeof(r->name) - 1] = '\0';
    strncpy(r->door_number, door_num, sizeof(r->door_number) - 1); r->door_number[sizeof(r->door_number) - 1] = '\0';
    strncpy(r->contact, contact, sizeof(r->contact) - 1); r->contact[sizeof(r->contact) - 1] = '\0';
    r->ownership_status = own_status;
    strncpy(r->parking_slot, parking, sizeof(r->parking_slot) - 1); r->parking_slot[sizeof(r->parking_slot) - 1] = '\0';
    r->left = r->right = NULL;
    return r;
}

Resident* insert_resident(Resident* root, Resident* new_resident) {
    if (!root) return new_resident;
    if (strcmp(new_resident->door_number, root->door_number) < 0) root->left = insert_resident(root->left, new_resident);
    else if (strcmp(new_resident->door_number, root->door_number) > 0) root->right = insert_resident(root->right, new_resident);
    return root;
}

bool resident_exists(Resident* root, const char* door_num) {
    if (!root) return false;
    if (strcmp(door_num, root->door_number) == 0) return true;
    if (strcmp(door_num, root->door_number) < 0) return resident_exists(root->left, door_num);
    return resident_exists(root->right, door_num);
}

Resident* find_resident_recursive(Resident* root, const char* door_num) {
    if (!root) return NULL;
    if (strcmp(door_num, root->door_number) == 0) return root;
    if (strcmp(door_num, root->door_number) < 0) return find_resident_recursive(root->left, door_num);
    return find_resident_recursive(root->right, door_num);
}

Resident* find_min_resident(Resident* root) {
    if (!root) return NULL;
    if (!root->left) return root;
    return find_min_resident(root->left);
}

Resident* delete_resident_recursive(Resident* root, const char* door_num) {
    if (!root) return NULL;
    if (strcmp(door_num, root->door_number) < 0) {
        root->left = delete_resident_recursive(root->left, door_num);
    } else if (strcmp(door_num, root->door_number) > 0) {
        root->right = delete_resident_recursive(root->right, door_num);
    } else {
        if (!root->left) { Resident* t = root->right; free(root); return t; }
        if (!root->right) { Resident* t = root->left; free(root); return t; }
        Resident* t = find_min_resident(root->right);
        strcpy(root->door_number, t->door_number);
        strcpy(root->name, t->name);
        strcpy(root->contact, t->contact);
        root->ownership_status = t->ownership_status;
        strcpy(root->parking_slot, t->parking_slot);
        root->right = delete_resident_recursive(root->right, t->door_number);
    }
    return root;
}

const char* ownership_to_str(OwnershipStatus status) {
    return status == OWNER ? "OWNER" : "TENANT";
}

OwnershipStatus str_to_ownership(const char* str) {
    return strcmp(str, "TENANT") == 0 ? TENANT : OWNER;
}

void print_resident_json(Resident* resident, const char* block_name, int floor_number) {
    printf("{\"name\":\"%s\",\"door_number\":\"%s\",\"contact\":\"%s\","
           "\"ownership\":\"%s\",\"parking_slot\":\"%s\",\"block\":\"%s\",\"floor\":%d}",
           resident->name, resident->door_number, resident->contact,
           ownership_to_str(resident->ownership_status), resident->parking_slot,
           block_name, floor_number);
}

void print_resident_tree_json(Resident* root, const char* block_name, int floor_number, int* first) {
    if (!root) return;
    print_resident_tree_json(root->left, block_name, floor_number, first);
    if (!*first) printf(","); else *first = 0;
    print_resident_json(root, block_name, floor_number);
    print_resident_tree_json(root->right, block_name, floor_number, first);
}

void print_all_residents_json(ResidentManagementSystem* rms) {
    printf("[");
    Block* block = rms->block_list;
    int first = 1;
    while (block) {
        Floor* floor = block->floor_list;
        while (floor) {
            print_resident_tree_json(floor->resident_tree, block->block_name, floor->floor_number, &first);
            floor = floor->next;
        }
        block = block->next;
    }
    printf("]");
}

const char* case_insensitive_strstr(const char* haystack, const char* needle) {
    if (!*needle) return haystack;
    for (; *haystack; haystack++) {
        if (tolower((unsigned char)*haystack) == tolower((unsigned char)*needle)) {
            const char *h = haystack, *n = needle;
            while (*h && *n && tolower((unsigned char)*h) == tolower((unsigned char)*n)) { h++; n++; }
            if (!*n) return haystack;
        }
    }
    return NULL;
}

// Iterative in-order walk of one floor's tree, applying `match` and printing hits.
typedef bool (*ResidentMatcher)(Resident*, const char*);

void walk_and_match(Resident* root, const char* block_name, int floor_number,
                     ResidentMatcher match, const char* query, int* first) {
    Resident* stack[100];
    int top = -1;
    Resident* current = root;
    while (1) {
        while (current) { stack[++top] = current; current = current->left; }
        if (top == -1) break;
        current = stack[top--];
        if (!match || match(current, query)) {
            if (!*first) printf(","); else *first = 0;
            print_resident_json(current, block_name, floor_number);
        }
        current = current->right;
    }
}

bool match_phone(Resident* r, const char* q) { return strcmp(r->contact, q) == 0; }
bool match_name(Resident* r, const char* q) { return case_insensitive_strstr(r->name, q) != NULL; }
bool match_all(Resident* r, const char* q) { (void)r; (void)q; return true; }

void handle_search_command(ResidentManagementSystem* rms, int argc, char* argv[]) {
    printf("[");
    int first = 1;

    if (argc == 4 && strcmp(argv[2], "door") == 0) {
        Block* block = rms->block_list;
        while (block) {
            Floor* floor = block->floor_list;
            while (floor) {
                Resident* resident = find_resident_recursive(floor->resident_tree, argv[3]);
                if (resident) {
                    if (!first) printf(","); else first = 0;
                    print_resident_json(resident, block->block_name, floor->floor_number);
                }
                floor = floor->next;
            }
            block = block->next;
        }
    } else if (argc == 4 && (strcmp(argv[2], "phone") == 0 || strcmp(argv[2], "name") == 0)) {
        ResidentMatcher matcher = strcmp(argv[2], "phone") == 0 ? match_phone : match_name;
        Block* block = rms->block_list;
        while (block) {
            Floor* floor = block->floor_list;
            while (floor) {
                walk_and_match(floor->resident_tree, block->block_name, floor->floor_number, matcher, argv[3], &first);
                floor = floor->next;
            }
            block = block->next;
        }
    } else if (argc == 4 && strcmp(argv[2], "block") == 0) {
        Block* block = find_block_recursive(rms->block_list, argv[3]);
        if (block) {
            Floor* floor = block->floor_list;
            while (floor) {
                walk_and_match(floor->resident_tree, block->block_name, floor->floor_number, match_all, "", &first);
                floor = floor->next;
            }
        }
    } else if (argc == 4 && strcmp(argv[2], "floor") == 0) {
        int floor_number = atoi(argv[3]);
        Block* block = rms->block_list;
        while (block) {
            Floor* floor = find_floor_recursive(block->floor_list, floor_number);
            if (floor) walk_and_match(floor->resident_tree, block->block_name, floor->floor_number, match_all, "", &first);
            block = block->next;
        }
    }

    printf("]");
}

void add_block(ResidentManagementSystem* rms, const char* block_name) {
    Block* b = malloc(sizeof(Block));
    if (!b) return;
    strncpy(b->block_name, block_name, sizeof(b->block_name) - 1);
    b->block_name[sizeof(b->block_name) - 1] = '\0';
    b->floor_list = NULL;
    b->next = rms->block_list;
    rms->block_list = b;
}

void add_floor(ResidentManagementSystem* rms, const char* block_name, int floor_number) {
    Block* block = find_block_recursive(rms->block_list, block_name);
    if (!block) { add_block(rms, block_name); block = find_block_recursive(rms->block_list, block_name); }
    Floor* f = malloc(sizeof(Floor));
    if (!f) return;
    f->floor_number = floor_number;
    f->resident_tree = NULL;
    f->next = block->floor_list;
    block->floor_list = f;
}

// Returns NULL on success, or a static error message on failure.
const char* add_resident(ResidentManagementSystem* rms, const char* name, const char* block_name,
                          int floor_number, const char* door_alpha, const char* contact,
                          OwnershipStatus own_status, const char* parking) {
    char door_num[50];
    snprintf(door_num, sizeof(door_num), "%s-%d-%s", block_name, floor_number, door_alpha);

    Block* block = find_block_recursive(rms->block_list, block_name);
    if (!block) { add_block(rms, block_name); block = find_block_recursive(rms->block_list, block_name); }

    Floor* floor = find_floor_recursive(block->floor_list, floor_number);
    if (!floor) { add_floor(rms, block_name, floor_number); floor = find_floor_recursive(block->floor_list, floor_number); }

    if (resident_exists(floor->resident_tree, door_num)) return "Door number already exists";

    Resident* new_resident = create_resident(name, door_num, contact, own_status, parking);
    if (!new_resident) return "Memory allocation failed";

    floor->resident_tree = insert_resident(floor->resident_tree, new_resident);
    return NULL;
}

const char* delete_resident(ResidentManagementSystem* rms, const char* door_num) {
    Block* block = rms->block_list;
    while (block) {
        Floor* floor = block->floor_list;
        while (floor) {
            if (resident_exists(floor->resident_tree, door_num)) {
                floor->resident_tree = delete_resident_recursive(floor->resident_tree, door_num);
                return NULL;
            }
            floor = floor->next;
        }
        block = block->next;
    }
    return "Resident not found";
}

void free_resident_tree(Resident* root) {
    if (!root) return;
    free_resident_tree(root->left);
    free_resident_tree(root->right);
    free(root);
}

void free_floor_list(Floor* floor) {
    if (!floor) return;
    free_floor_list(floor->next);
    free_resident_tree(floor->resident_tree);
    free(floor);
}

void free_block_list(Block* block) {
    if (!block) return;
    free_block_list(block->next);
    free_floor_list(block->floor_list);
    free(block);
}

void cleanup_system(ResidentManagementSystem* rms) {
    if (!rms) return;
    free_block_list(rms->block_list);
    free(rms);
}

// Reads CSV rows from stdin: "name","door_number","contact","ownership","parking","block",floor
// One row per resident, no header line — Node fully controls this format on both ends.
void load_from_stdin(ResidentManagementSystem* rms) {
    char line[MAX_LINE_LENGTH];
    while (fgets(line, sizeof(line), stdin)) {
        line[strcspn(line, "\n")] = '\0';
        if (line[0] == '\0') continue;

        char* tokens[7];
        int i = 0;
        char* token = strtok(line, ",");
        while (token != NULL && i < 7) {
            if (token[0] == '"' && token[strlen(token) - 1] == '"') {
                token[strlen(token) - 1] = '\0';
                token++;
            }
            tokens[i++] = token;
            token = strtok(NULL, ",");
        }
        if (i != 7) continue;

        char* name = tokens[0];
        char* door_number = tokens[1];
        char* contact = tokens[2];
        OwnershipStatus own_status = str_to_ownership(tokens[3]);
        char* parking = tokens[4];
        char* block_name = tokens[5];
        int floor_number = atoi(tokens[6]);

        char prefix[60];
        snprintf(prefix, sizeof(prefix), "%s-%d-", block_name, floor_number);
        const char* door_alpha = strncmp(door_number, prefix, strlen(prefix)) == 0
            ? door_number + strlen(prefix)
            : door_number;

        add_resident(rms, name, block_name, floor_number, door_alpha, contact, own_status, parking);
    }
}

int main(int argc, char* argv[]) {
#ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY);
#endif

    ResidentManagementSystem* rms = malloc(sizeof(ResidentManagementSystem));
    rms->block_list = NULL;
    load_from_stdin(rms);

    printf("{\"result\":");

    if (argc < 2) {
        printf("{\"status\":\"error\",\"message\":\"No command specified\"}");
    } else if (strcmp(argv[1], "list") == 0) {
        print_all_residents_json(rms);
    } else if (strcmp(argv[1], "add") == 0 && argc == 9) {
        const char* err = add_resident(rms, argv[2], argv[3], atoi(argv[4]), argv[5], argv[6],
                                        strcmp(argv[7], "TENANT") == 0 ? TENANT : OWNER, argv[8]);
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Resident added\"}");
    } else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        const char* err = delete_resident(rms, argv[2]);
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Resident deleted\"}");
    } else if (strcmp(argv[1], "search") == 0 && argc >= 3) {
        handle_search_command(rms, argc, argv);
    } else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command or arguments\"}");
    }

    printf(",\"state\":");
    print_all_residents_json(rms);
    printf("}");

    cleanup_system(rms);
    return 0;
}
