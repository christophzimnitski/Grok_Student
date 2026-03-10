//
//  KeychainHelper.mm
//  Grok Student
//

#import "KeychainHelper.h"
#import <Security/Security.h>

@implementation KeychainHelper

+ (NSMutableDictionary *)keychainQueryForAPI:(NSString *)api {
    return [@{(__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
              (__bridge id)kSecAttrService: @"GrokStudentAPI",
              (__bridge id)kSecAttrAccount: [NSString stringWithFormat:@"%@_api_key", api.lowercaseString]} mutableCopy];
}

+ (BOOL)saveAPIKey:(NSString *)apiKey forAPI:(NSString *)api {
    [self deleteAPIKeyForAPI:api];  // Overwrite if exists
    
    NSMutableDictionary *query = [self keychainQueryForAPI:api];
    query[(__bridge id)kSecValueData] = [apiKey dataUsingEncoding:NSUTF8StringEncoding];
    
    OSStatus status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
    return status == errSecSuccess;
}

+ (NSString *)getAPIKeyForAPI:(NSString *)api {
    NSMutableDictionary *query = [self keychainQueryForAPI:api];
    query[(__bridge id)kSecReturnData] = @YES;
    query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;
    
    CFDataRef dataRef = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, (CFTypeRef *)&dataRef);
    
    if (status == errSecSuccess && dataRef) {
        NSString *apiKey = [[NSString alloc] initWithData:(__bridge NSData *)dataRef encoding:NSUTF8StringEncoding];
        CFRelease(dataRef);
        return apiKey;
    }
    return nil;
}

+ (BOOL)deleteAPIKeyForAPI:(NSString *)api {
    NSMutableDictionary *query = [self keychainQueryForAPI:api];
    OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);
    return status == errSecSuccess || status == errSecItemNotFound;
}

@end
