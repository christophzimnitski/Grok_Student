#import "KeychainHelper.h"
#import <Security/Security.h>

@implementation KeychainHelper

+ (NSMutableDictionary *)keychainQueryForKey:(NSString *)key {
    return [@{(__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
              (__bridge id)kSecAttrService: @"GrokStudentAPI",
              (__bridge id)kSecAttrAccount: key} mutableCopy];
}

+ (BOOL)saveAPIKey:(NSString *)apiKey {
    [self deleteAPIKey];  // Overwrite if exists
    
    NSMutableDictionary *query = [self keychainQueryForKey:@"xai_api_key"];
    query[(__bridge id)kSecValueData] = [apiKey dataUsingEncoding:NSUTF8StringEncoding];
    
    OSStatus status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
    return status == errSecSuccess;
}

+ (NSString *)getAPIKey {
    NSMutableDictionary *query = [self keychainQueryForKey:@"xai_api_key"];
    query[(__bridge id)kSecReturnData] = @YES;
    query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;
    
    CFDataRef dataRef = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, (CFTypeRef *)&dataRef);
    
    if (status == errSecSuccess && dataRef) {
        NSString *apiKey = [[NSString alloc] initWithData:(__bridge NSData *)dataRef encoding:NSUTF8StringEncoding];
        return apiKey;
    }
    return nil;
}

+ (BOOL)deleteAPIKey {
    NSMutableDictionary *query = [self keychainQueryForKey:@"xai_api_key"];
    OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);
    return status == errSecSuccess || status == errSecItemNotFound;
}

@end
